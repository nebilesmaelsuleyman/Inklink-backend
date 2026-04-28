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
    let library = await this.libraryModel.findOne({ userId });
    if (!library) {
      library = await this.libraryModel.create({ userId });
    }

    const workObjectId = new Types.ObjectId(workId);
    
    // Filter out if already exists to move it to the front
    const updatedList = library.currentlyReading.filter(
      (cr) => cr.workId.toString() !== workId,
    );

    // Add to the front
    updatedList.unshift({ workId: workObjectId, progress });

    library.currentlyReading = updatedList as any;

    await library.save();
    return this.getLibrary(userId);
  }

  async toggleBookmark(userId: string, workId: string) {
    let library = await this.libraryModel.findOne({ userId });
    if (!library) {
      library = await this.libraryModel.create({ userId });
    }

    const workObjectId = new Types.ObjectId(workId);
    const index = library.bookmarked.findIndex(
      (id) => id.toString() === workId,
    );

    if (index > -1) {
      library.bookmarked.splice(index, 1);
    } else {
      library.bookmarked.push(workObjectId);
    }

    await library.save();
    return this.getLibrary(userId);
  }

  async createReadList(userId: string, name: string, description: string) {
    let library = await this.libraryModel.findOne({ userId });
    if (!library) {
      library = await this.libraryModel.create({ userId });
    }

    library.readLists.push({
      name,
      description,
      works: [],
    });

    await library.save();
    return this.getLibrary(userId);
  }

  async deleteReadList(userId: string, listId: string) {
    const library = await this.libraryModel.findOne({ userId });
    if (!library) throw new NotFoundException('Library not found');

    library.readLists = library.readLists.filter(
      (list) => list._id?.toString() !== listId,
    );

    await library.save();
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
    const library = await this.libraryModel.findOne({ userId });
    if (!library) throw new NotFoundException('Library not found');

    const list = library.readLists.find(
      (list) => list._id?.toString() === listId,
    );
    if (!list) throw new NotFoundException('Reading list not found');

    const workObjectId = new Types.ObjectId(workId);
    const index = list.works.findIndex((id) => id.toString() === workId);

    if (index > -1) {
      list.works.splice(index, 1);
    } else {
      list.works.push(workObjectId);
    }

    await library.save();
    return this.getLibrary(userId);
  }
}
