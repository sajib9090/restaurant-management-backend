import createError from "http-errors";
import { ObjectId } from "mongodb";
import { membersCollection } from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";
import validator from "validator";

export const handleCreateMember = async (req, res, next) => {
  const { user } = req.user;
  const { name, mobile } = req.body;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }

    requiredField(name, "Name is required");
    requiredField(mobile, "Mobile is required");

    const processedName = validateString(name, "Name", 2, 100);
    if (mobile?.length !== 11) {
      throw createError(400, "Mobile number must be 11 characters");
    }
    if (!validator.isMobilePhone(mobile, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const existingMobile = await membersCollection.findOne({
      $and: [{ brand: user?.brand_id }, { mobile: mobile }],
    });

    if (existingMobile) {
      throw createError(400, "Member already exists in this brand");
    }

    const count = await membersCollection.countDocuments();
    const generateCode = crypto.randomBytes(12).toString("hex");

    const newMember = {
      member_id: count + 1 + "-" + generateCode,
      name: processedName,
      brand: user?.brand_id,
      mobile: mobile,
      discount_value: 10,
      total_discount: 0,
      total_spent: 0,
      invoices: [],
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    await membersCollection.insertOne(newMember);

    res.status(200).send({
      success: true,
      message: "New member created",
      data: newMember,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetMembers = async (req, res, next) => {
  try {
    const { user } = req.user;

    if (!user) {
      throw createError(401, "User not found. Login Again");
    }

    const search = req.query.search || "";
    const spent = req.query.spent || "";
    const discount = req.query.discount || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit);

    const regExSearch = new RegExp(".*" + search + ".*", "i");

    let query;
    if (user?.role == "super admin") {
      if (search) {
        query = {
          $or: [{ name: regExSearch }, { mobile: regExSearch }],
        };
      } else {
        query = {};
      }
    } else {
      if (search) {
        query = {
          $and: [
            {
              brand: user?.brand_id,
            },
          ],
          $or: [{ name: regExSearch }, { mobile: regExSearch }],
        };
      } else {
        query = { brand: user?.brand_id };
      }
    }

    let sortCriteria = { name: 1 };

    if (spent === "high-to-low") {
      sortCriteria = { total_spent: -1 };
    } else if (spent === "low-to-high") {
      sortCriteria = { total_spent: 1 };
    }
    if (discount === "high-to-low") {
      sortCriteria = { total_discount: -1 };
    } else if (discount === "low-to-high") {
      sortCriteria = { total_discount: 1 };
    }

    const members = await membersCollection
      .find(query)
      .sort(sortCriteria)
      .limit(limit)
      .skip((page - 1) * limit)
      .toArray();

    const count = await membersCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Members retrieved successfully",
      data_found: count,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        previousPage: page - 1 > 0 ? page - 1 : null,
        nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
      },
      data: members,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSingleMemberByMobile = async (req, res, next) => {
  const { mobile } = req.params;
  const { user } = req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login");
    }

    requiredField(mobile, "Mobile number is required");
    if (mobile?.length !== 11) {
      throw createError(400, "Mobile number should be 11 characters");
    }
    if (!validator.isMobilePhone(mobile, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const member = await membersCollection.findOne({
      $and: [{ brand: user?.brand_id }, { mobile: mobile }],
    });

    if (!member) {
      throw createError(400, "Member not found with this number");
    }

    res.status(200).send({
      success: true,
      message: "Member retrieved successfully",
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteMember = async (req, res, next) => {
  const { ids } = req.body;

  try {
    if (!Array.isArray(ids)) {
      throw createError("ids must be an array");
    }

    const criteria = { member_id: { $in: ids } };

    const result = await membersCollection.deleteMany(criteria);
    if (result.deletedCount == 0) {
      throw createError(404, "Document not found for deletion");
    }
    res.status(200).send({
      success: true,
      message: "Member deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
