import express from "express";
import {
  getProfile,
  updateProfile,
  followUser,
} from "./profile.controller";

import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/:id", getProfile);
router.put("/", protect, updateProfile);
router.post("/follow/:id", protect, followUser);

export default router;