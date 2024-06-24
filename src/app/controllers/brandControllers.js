import createError from "http-errors";
import { ObjectId } from "mongodb";
import { brandsCollection } from "../collections/collections.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../helpers/cloudinary.js";
import slugify from "slugify";
import { validateString } from "../helpers/validateString.js";
import validator from "validator";

export const handleUpdateBrandLogo = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const bufferFile = req.file.buffer;

  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    if (!bufferFile) {
      throw createError(400, "Brand logo is required");
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
  const user = req.user.user ? req.user.user : req.user;
  const { brand_name, mobile1, mobile2, location, sub_district, district } =
    req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    if (user?.role != "chairman" && user?.role != "admin") {
      throw createError(403, "Forbidden access. Only authority can access");
    }

    const existingBrand = await brandsCollection.findOne({
      brand_id: user?.brand_id,
    });

    if (!existingBrand) {
      throw createError(404, "Brand not found");
    }

    let updateFields = {};
    if (existingBrand?.brand_name != brand_name) {
      const processedBrandName = validateString(
        brand_name,
        "Brand Name",
        2,
        100
      );

      const brandNameSlug = slugify(processedBrandName);
      updateFields.brand_name = processedBrandName;
      updateFields.brand_slug = brandNameSlug;
    }

    if (existingBrand?.contact?.mobile1 != mobile1) {
      if (mobile1?.length != 11) {
        throw createError(400, "Mobile number must be 11 characters");
      }
      if (!validator.isMobilePhone(mobile1, "any")) {
        throw createError(400, "Invalid mobile number");
      }

      updateFields["contact.mobile1"] = mobile1;
    }
    if (existingBrand?.contact?.mobile2 != mobile2) {
      if (mobile2?.length != 11) {
        throw createError(400, "Mobile number must be 11 characters");
      }
      if (!validator.isMobilePhone(mobile2, "any")) {
        throw createError(400, "Invalid mobile number");
      }

      updateFields["contact.mobile2"] = mobile2;
    }

    if (existingBrand?.address?.location != location) {
      const processedLocation = validateString(location, "Location", 2, 300);
      updateFields["address.location"] = processedLocation;
    }
    if (existingBrand?.address?.sub_district != sub_district) {
      const processedSubDistrict = validateString(
        sub_district,
        "Sub District",
        2,
        50
      );
      updateFields["address.sub_district"] = processedSubDistrict;
    }
    if (existingBrand?.address?.district != district) {
      const processedDistrict = validateString(district, "District", 2, 50);
      updateFields["address.district"] = processedDistrict;
    }

    if (Object.keys(updateFields).length === 0) {
      throw createError(400, "No fields to update");
    }

    updateFields.updatedAt = new Date();
    updateFields.updatedBy = user?.user_id;

    const result = await brandsCollection.findOneAndUpdate(
      { brand_id: existingBrand?.brand_id },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    res.status(200).send({
      success: true,
      message: "Brand info updated successfully",
      updatedBrand: result.value,
    });
  } catch (error) {
    next(error);
  }
};
