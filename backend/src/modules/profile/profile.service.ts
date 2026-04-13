import { ProfileModel } from "./profile.model";

export const getProfileService = async (userId: string) => {
  return await ProfileModel.findById(userId)
    .populate("followers", "username profilePicture")
    .populate("readingList")
    .populate("favoriteBook");
};

export const updateProfileService = async (
  userId: string,
  updates: any
) => {
  return await ProfileModel.findByIdAndUpdate(userId, updates, {
    new: true,
  });
};

export const followUserService = async (
  currentUserId: string,
  targetUserId: string
) => {
  const user = await ProfileModel.findById(targetUserId);

  if (!user) throw new Error("User not found");

  user.followers.push(currentUserId as any);
  await user.save();

  return user;
};