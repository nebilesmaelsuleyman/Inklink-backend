import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { hash } from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { USER_MODEL_NAME, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @Optional()
    @InjectModel(USER_MODEL_NAME)
    private readonly userModel?: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    if (!this.userModel) {
      return null;
    }

    const payload = { ...createUserDto };
    payload.password = await this.hashPassword(createUserDto.password);

    const user = new this.userModel(payload);
    return user.save();
  }

  async findAll() {
    if (!this.userModel) {
      return [];
    }

    return this.userModel.find().select('-password').lean();
  }

  async findOne(id: string) {
    if (!this.userModel) {
      return null;
    }

    return this.userModel.findById(id).select('-password').lean();
  }

  async findByUsername(username: string) {
    if (!this.userModel || !username) {
      return null;
    }

    return this.userModel.findOne({ username: username.toLowerCase() });
  }

  async findByEmail(email: string) {
    if (!this.userModel || !email) {
      return null;
    }

    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (!this.userModel) {
      return null;
    }

    const payload: UpdateUserDto = { ...updateUserDto };

    if (payload.password) {
      payload.password = await this.hashPassword(payload.password);
    }

    return this.userModel
      .findByIdAndUpdate(id, payload, { new: true })
      .select('-password')
      .lean();
  }

  async remove(id: string) {
    if (!this.userModel) {
      return null;
    }

    return this.userModel.findByIdAndDelete(id).lean();
  }

  async findChildren(parentId: string) {
    if (!this.userModel) {
      return [];
    }
    return this.userModel.find({ parentId }).select('-password').lean();
  }

  async removeChild(parentId: string, childId: string) {
    if (!this.userModel) {
      return null;
    }
    return this.userModel.findOneAndDelete({ _id: childId, parentId }).lean();
  }

  private hashPassword(password: string) {
    return hash(password, 10);
  }
}
