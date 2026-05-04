import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model, Types } from 'mongoose';
import path from 'path';
import { CHAPTER_MODEL_NAME, ChapterDocument } from '../chapters/schema/chapter.schema';
import { PROFILE_MODEL_NAME } from '../profile/profile.model';
import { Profile } from '../profile/profile.type';
import { USER_MODEL_NAME, UserDocument } from '../users/user.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';

type PricingPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
};

const DEFAULT_PRICING: PricingPlan[] = [
  { id: 'weekly', name: 'Weekly', price: 50, currency: 'ETB', period: 'per week' },
  { id: 'monthly', name: 'Monthly', price: 150, currency: 'ETB', period: 'per month' },
  { id: 'yearly', name: 'Yearly', price: 1500, currency: 'ETB', period: 'per year' },
];

@Injectable()
export class AdminService {
  private readonly pricingPath = path.resolve(
    process.cwd(),
    'data',
    'admin-pricing.json',
  );

  constructor(
    @InjectModel(USER_MODEL_NAME)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PROFILE_MODEL_NAME)
    private readonly profileModel: Model<Profile>,
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
    @InjectModel(CHAPTER_MODEL_NAME)
    private readonly chapterModel: Model<ChapterDocument>,
  ) {}

  async getOverview() {
    const [users, authors, content, monetizedAuthors] = await Promise.all([
      this.userModel.countDocuments(),
      this.profileModel.countDocuments({ isCreator: true }),
      this.chapterModel.countDocuments(),
      this.profileModel.countDocuments({ isCreator: true, isMonetized: true } as any),
    ]);

    return {
      users,
      authors,
      content,
      premiumSubscriptions: monetizedAuthors,
      platformHealth: 98.5,
      serverStatus: 'operational',
    };
  }

  async getUsers(search?: string) {
    const query =
      search && search.trim()
        ? {
            $or: [
              { username: { $regex: search.trim(), $options: 'i' } },
              { email: { $regex: search.trim(), $options: 'i' } },
            ],
          }
        : {};

    const users = await this.userModel
      .find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const profiles = await this.profileModel
      .find({
        username: {
          $in: users.map((user) => user.username).filter(Boolean),
        },
      })
      .lean()
      .exec();

    const profileMap = new Map(
      profiles.map((profile: any) => [profile.username, profile]),
    );

    return users.map((user: any) => {
      const profile: any = profileMap.get(user.username);
      return {
        id: user._id.toString(),
        name: profile?.name || user.username,
        email: user.email || '',
        bio: profile?.bio || '',
        joinDate: user.createdAt,
        profileImage: profile?.profilePicture || '',
      };
    });
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    await Promise.all([
      this.profileModel.findByIdAndDelete(id).exec(),
      this.profileModel.deleteOne({ username: user.username } as any).exec(),
      this.workModel.deleteMany({ authorId: new Types.ObjectId(id) }).exec(),
    ]);

    return { success: true };
  }

  async getAuthors(search?: string, monetized?: string) {
    const query: any = { isCreator: true };

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { username: { $regex: search.trim(), $options: 'i' } },
        { bio: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (monetized === 'true') query.isMonetized = true;
    if (monetized === 'false') query.isMonetized = false;

    const profiles = await this.profileModel.find(query).lean().exec();
    const authorIds = profiles
      .map((profile: any) => {
        if (Types.ObjectId.isValid(profile._id)) return new Types.ObjectId(profile._id);
        return null;
      })
      .filter(Boolean) as Types.ObjectId[];

    const works = await this.workModel
      .find({ authorId: { $in: authorIds } })
      .select('authorId')
      .lean()
      .exec();

    const worksCount = new Map<string, number>();
    for (const work of works) {
      const key = work.authorId.toString();
      worksCount.set(key, (worksCount.get(key) || 0) + 1);
    }

    return profiles.map((profile: any) => ({
      id: profile._id.toString(),
      name: profile.name || profile.username,
      username: profile.username,
      bio: profile.bio || '',
      profileImage: profile.profilePicture || '',
      isMonetized: Boolean((profile as any).isMonetized),
      followers: Array.isArray(profile.followers) ? profile.followers.length : 0,
      worksCount: worksCount.get(profile._id.toString()) || 0,
    }));
  }

  async updateAuthorMonetization(id: string, isMonetized?: boolean) {
    if (typeof isMonetized !== 'boolean') {
      throw new BadRequestException('isMonetized must be a boolean');
    }

    const updated = await this.profileModel
      .findByIdAndUpdate(id, { $set: { isMonetized } } as any, { returnDocument: 'after' })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Author not found');

    return {
      id: updated._id.toString(),
      isMonetized: Boolean((updated as any).isMonetized),
    };
  }

  async deleteAuthor(id: string) {
    const profile = await this.profileModel.findByIdAndDelete(id).lean().exec();
    if (!profile) throw new NotFoundException('Author not found');

    const user = await this.userModel.findOneAndDelete({ username: (profile as any).username }).lean().exec();
    if (user?._id) {
      await this.workModel.deleteMany({ authorId: user._id }).exec();
    }

    return { success: true };
  }

  async getContent(search?: string, status?: string) {
    const chapterQuery: any = {};

    if (search && search.trim()) {
      chapterQuery.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { contentText: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (status === 'success') chapterQuery.moderationStatus = 'approved';
    if (status === 'warning') chapterQuery.moderationStatus = 'needs_admin_review';
    if (status === 'fail') chapterQuery.moderationStatus = 'rejected';

    const chapters = await this.chapterModel
      .find(chapterQuery)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    const workIds = Array.from(
      new Set(chapters.map((chapter) => chapter.workId.toString())),
    ).map((id) => new Types.ObjectId(id));
    const works = await this.workModel
      .find({ _id: { $in: workIds } })
      .select('title authorId')
      .lean()
      .exec();
    const authorIds = Array.from(new Set(works.map((work) => work.authorId.toString()))).map(
      (id) => new Types.ObjectId(id),
    );
    const users = await this.userModel
      .find({ _id: { $in: authorIds } })
      .select('username')
      .lean()
      .exec();

    const workMap = new Map(works.map((work) => [work._id.toString(), work]));
    const userMap = new Map(users.map((user: any) => [user._id.toString(), user.username]));

    return chapters.map((chapter: any) => {
      const work: any = workMap.get(chapter.workId.toString());
      return {
        id: chapter._id.toString(),
        title: chapter.title,
        workTitle: work?.title || '',
        author: userMap.get(work?.authorId?.toString?.() || '') || 'Unknown author',
        publishedAt: chapter.updatedAt,
        status:
          chapter.moderationStatus === 'approved'
            ? 'success'
            : chapter.moderationStatus === 'rejected'
              ? 'fail'
              : 'warning',
        content: chapter.contentText || '',
      };
    });
  }

  async publishContent(id: string, adminId?: string) {
    const updated = await this.chapterModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            moderationStatus: 'approved',
            moderationReason: 'approved_by_admin',
            moderationUpdatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Content not found');

    return {
      id: updated._id.toString(),
      status: 'success',
      reviewedBy: adminId || null,
    };
  }

  async deleteContent(id: string) {
    const deleted = await this.chapterModel.findByIdAndDelete(id).lean().exec();
    if (!deleted) throw new NotFoundException('Content not found');
    return { success: true };
  }

  async getPricing() {
    await this.ensurePricingFile();
    const raw = await fs.readFile(this.pricingPath, 'utf-8');
    const parsed = JSON.parse(raw) as { plans?: PricingPlan[] };
    return { plans: parsed.plans || DEFAULT_PRICING };
  }

  async updatePricing(plans: PricingPlan[]) {
    if (!Array.isArray(plans) || plans.length === 0) {
      throw new BadRequestException('plans are required');
    }

    const normalizedPlans = plans.map((plan) => ({
      id: String(plan.id || '').trim(),
      name: String(plan.name || '').trim(),
      price: Number(plan.price || 0),
      currency: String(plan.currency || 'ETB').trim(),
      period: String(plan.period || '').trim(),
    }));

    if (normalizedPlans.some((plan) => !plan.id || !plan.name || !plan.period)) {
      throw new BadRequestException('Each plan must include id, name, and period');
    }

    await this.ensurePricingFile();
    await fs.writeFile(
      this.pricingPath,
      JSON.stringify({ plans: normalizedPlans }, null, 2),
      'utf-8',
    );

    return { plans: normalizedPlans };
  }

  private async ensurePricingFile() {
    const dir = path.dirname(this.pricingPath);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(this.pricingPath);
    } catch {
      await fs.writeFile(
        this.pricingPath,
        JSON.stringify({ plans: DEFAULT_PRICING }, null, 2),
        'utf-8',
      );
    }
  }
}
