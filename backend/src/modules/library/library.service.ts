import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LIBRARY_MODEL_NAME, LibraryDocument } from './schemas/library.schema';

@Injectable()
export class LibraryService {
  constructor(
    @InjectModel(LIBRARY_MODEL_NAME)
    private libraryModel: Model<LibraryDocument>,
  ) {}

  async getLibrary(userId: string): Promise<LibraryDocument> {
    let library = await this.libraryModel
      .findOne({ userId })
      .populate({
        path: 'currentlyReading.workId',
        populate: { path: 'authorId', select: 'username' },
      })
      .populate({
        path: 'bookmarked',
        populate: { path: 'authorId', select: 'username' },
      })
      .populate('readLists.works');

    if (!library) {
      library = await this.libraryModel.create({
        userId,
        currentlyReading: [],
        bookmarked: [],
        readLists: [],
      });
    }

    return library;
  }

  async updateCurrentlyReading(
    userId: string,
    workId: string,
    progress: number,
  ) {
    const workObjectId = new Types.ObjectId(workId);

    // 1. Remove the work from the list if it exists to move it to the front later
    await this.libraryModel.updateOne(
      { userId },
      { $pull: { currentlyReading: { workId: workObjectId } } },
    );

    // 2. Add it to the front with new progress
    // Using findOneAndUpdate with upsert: true ensures the library document exists
    await this.libraryModel.findOneAndUpdate(
      { userId },
      {
        $push: {
          currentlyReading: {
            $each: [{ workId: workObjectId, progress }],
            $position: 0,
          },
        },
      },
      { upsert: true, new: true },
    );

    return this.getLibrary(userId);
  }

  async toggleBookmark(userId: string, workId: string) {
    const workObjectId = new Types.ObjectId(workId);

    // Attempt to remove the workId. If it was removed, it was already there.
    const result = await this.libraryModel.updateOne(
      { userId, bookmarked: workObjectId },
      { $pull: { bookmarked: workObjectId } },
    );

    if (result.matchedCount === 0) {
      // It wasn't there (or library doesn't exist), so add it.
      // findOneAndUpdate with upsert: true handles both adding and creation.
      await this.libraryModel.findOneAndUpdate(
        { userId },
        { $addToSet: { bookmarked: workObjectId } },
        { upsert: true },
      );
    }

    return this.getLibrary(userId);
  }

  async createReadList(userId: string, name: string, description: string) {
    await this.libraryModel.findOneAndUpdate(
      { userId },
      {
        $push: {
          readLists: { name, description, works: [] },
        },
      },
      { upsert: true },
    );
    return this.getLibrary(userId);
  }

  async deleteReadList(userId: string, listId: string) {
    const listObjectId = new Types.ObjectId(listId);
    const result = await this.libraryModel.updateOne(
      { userId },
      { $pull: { readLists: { _id: listObjectId } } },
    );
    if (result.matchedCount === 0)
      throw new NotFoundException('Library not found');

    return this.getLibrary(userId);
  }

  async findUsersWhoBookmarked(workId: string): Promise<string[]> {
    const workObjectId = new Types.ObjectId(workId);
    const libraries = await this.libraryModel
      .find({ bookmarked: workObjectId })
      .select('userId')
      .lean();
    return libraries.map((lib) => lib.userId.toString());
  }

  async toggleWorkInReadList(userId: string, listId: string, workId: string) {
    const workObjectId = new Types.ObjectId(workId);
    const listObjectId = new Types.ObjectId(listId);

    // Try to pull if exists
    const pullResult = await this.libraryModel.updateOne(
      {
        userId,
        'readLists._id': listObjectId,
        'readLists.works': workObjectId,
      },
      { $pull: { 'readLists.$.works': workObjectId } },
    );

    if (pullResult.matchedCount === 0) {
      // Not there, so push
      const pushResult = await this.libraryModel.updateOne(
        { userId, 'readLists._id': listObjectId },
        { $addToSet: { 'readLists.$.works': workObjectId } },
      );
      if (pushResult.matchedCount === 0) {
        throw new NotFoundException('Library or Reading list not found');
      }
    }

    return this.getLibrary(userId);
  }
}
