import { Request, Response } from "express";
import {
  getProfileService,
  updateProfileService,
  followUserService,
} from "./profile.service";

export const getProfile = async (req: Request, res: Response) => {
  try {
    const profile = await getProfileService(req.params.id as string);

    if (!profile)
      return res.status(404).json({ message: "Profile not found" });

    res.json({
      ...profile.toObject(),
      followersCount: profile.followers.length,
      creatorDashboard: profile.isCreator
        ? `/creator/${profile._id}`
        : null,
    });
  } catch (error) {
    res.status(500).json({ error });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const updated = await updateProfileService(
      req.user.id,
      req.body
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error });
  }
};

export const followUser = async (req: any, res: Response) => {
  try {
    await followUserService(req.user.id, req.params.id as string);

    res.json({ message: "Followed successfully" });
  } catch (error) {
    res.status(500).json({ error });
  }
};