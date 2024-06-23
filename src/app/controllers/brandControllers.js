import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  brandsCollection,
  usersCollection,
} from "../collections/collections.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../helpers/cloudinary.js";

export const handleUpdateBrandLogo = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const userId = req.params.id;
  const bufferFile = req.file.buffer;

  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }
    if (userId?.length < 33) {
      throw createError(400, "Invalid id");
    }

    if (!bufferFile) {
      throw createError(400, "Brand logo is required");
    }

    const existingUser = await usersCollection.findOne({
      user_id: userId,
    });

    if (!existingUser) {
      throw createError(404, "User not found");
    }

    const existingBrand = await brandsCollection.findOne({
      brand_id: user?.brand_id,
    });

    if (!existingBrand) {
      throw createError(404, "Brand not found");
    }

    if (
      existingBrand?.brand_logo &&
      existingBrand?.brand_logo?.id &&
      existingBrand?.brand_logo?.url
    ) {
      await deleteFromCloudinary(existingBrand?.brand_logo?.id);
    }

    const logo = await uploadOnCloudinary(bufferFile);

    if (!logo?.public_id) {
      a;
      throw createError(500, "Something went wrong. Brand logo not updated");
    }

    await brandsCollection.findOneAndUpdate(
      { _id: new ObjectId(existingBrand?._id) },
      { $set: { brand_logo: { id: logo?.public_id, url: logo?.url } } },
      { returnOriginal: false }
    );

    res.status(200).send({
      success: true,
      message: "Brand logo updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateBrandInfo = async (req, res, next) => {
  try {
    res.status(200).send({
      success: true,
      message: "Brand info updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
