import fs from "fs";
import path from "path";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../helpers/cloudinary.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const handleUploadAvatar = async (req, res, next) => {
  try {
    const filePath = req.file.path;

    const avatar = await uploadOnCloudinary(filePath);
    console.log(avatar, "avatar response");

    await delay(5000);

    // const deleteAvatar = await deleteFromCloudinary(avatar?.public_id);
    // console.log(deleteAvatar, "delete response");

    res.status(200).send({
      success: true,
      message: "Uploaded",
    });
  } catch (error) {
    next(error);
  }
};
