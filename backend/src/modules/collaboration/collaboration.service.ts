import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CollaborationDocument,
  CollaborationRole,
  CollaborationStatus,
} from './schema/collaboration.schema';
import { UsersService } from '../users/users.service';
import { WorksService } from '../works/works.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CollaborationService {
  constructor(
    @InjectModel('Collaboration')
    private readonly collaborationModel: Model<CollaborationDocument>,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => WorksService))
    private readonly worksService: WorksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async inviteCollaborator(
    workId: string,
    invitedBy: string,
    emailOrUsername: string,
  ) {
    // 1. Find user to invite
    const user = await this.usersService.findByEmailOrUsername(emailOrUsername);
    if (!user) throw new NotFoundException('User to invite not found');

    if (user._id.toString() === invitedBy) {
      throw new BadRequestException('You cannot invite yourself');
    }

    // 2. Check if already a collaborator
    const existing = await this.collaborationModel.findOne({
      workId: new Types.ObjectId(workId),
      userId: user._id,
    });
    if (existing) throw new ConflictException('User is already a collaborator');

    // 3. Create pending collaboration
    const collab = await this.collaborationModel.create({
      workId: new Types.ObjectId(workId),
      userId: user._id,
      invitedBy: new Types.ObjectId(invitedBy),
      role: CollaborationRole.EDITOR,
      status: CollaborationStatus.PENDING,
    });

    // 4. Notify user
    await this.notificationsService.createNotification({
      userId: user._id,
      type: 'collaboration' as any,
      title: 'New Collaboration Invite',
      description: `You have been invited to collaborate on a book.`,
      metadata: { workId, collabId: collab._id },
    });

    return collab;
  }

  async getCollaborators(workId: string) {
    return this.collaborationModel
      .find({ workId: new Types.ObjectId(workId) })
      .populate('userId', 'username email profilePicture')
      .exec();
  }

  async getUserInvites(userId: string) {
    return this.collaborationModel
      .find({ userId: new Types.ObjectId(userId), status: CollaborationStatus.PENDING })
      .populate('workId', 'title coverImage')
      .populate('invitedBy', 'username')
      .exec();
  }

  async respondToInvite(collabId: string, userId: string, accept: boolean) {
    const collab = await this.collaborationModel.findOne({
      _id: new Types.ObjectId(collabId),
      userId: new Types.ObjectId(userId),
    });

    if (!collab) throw new NotFoundException('Invitation not found');

    if (accept) {
      collab.status = CollaborationStatus.ACCEPTED;
      await collab.save();
    } else {
      await this.collaborationModel.deleteOne({ _id: collab._id });
    }

    return { success: true };
  }

  async removeCollaborator(workId: string, userId: string, actorId: string) {
    // Only owner can remove
    // (Logic for checking if actor is owner can be done here or in controller)
    await this.collaborationModel.deleteOne({
      workId: new Types.ObjectId(workId),
      userId: new Types.ObjectId(userId),
    });
    return { success: true };
  }

  async isCollaborator(workId: string, userId: string): Promise<boolean> {
    const collab = await this.collaborationModel.findOne({
      workId: new Types.ObjectId(workId),
      userId: new Types.ObjectId(userId),
      status: CollaborationStatus.ACCEPTED,
    });
    return !!collab;
  }

  async getCollaboratedWorks(userId: string) {
    const collabs = await this.collaborationModel
      .find({
        userId: new Types.ObjectId(userId),
        status: CollaborationStatus.ACCEPTED,
      })
      .populate({
        path: 'workId',
        populate: { path: 'authorId', select: 'username profilePicture' },
      })
      .lean()
      .exec();

    return collabs.map((c) => c.workId);
  }
}
