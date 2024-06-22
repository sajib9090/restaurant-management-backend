import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  membersCollection,
  soldInvoiceCollection,
} from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";
import validator from "validator";

export const handleAddSoldInvoice = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { table_name, member, served_by, items, total_bill, total_discount } =
    req.body;
  console.log(user);
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    requiredField(table_name, "Table name is required");
    requiredField(served_by, "Served by staff name is required");
    requiredField(total_bill, "Total bill is required");

    if (!Array.isArray(items) || items.length === 0) {
      throw createError(400, "Items are required and cannot be empty");
    }

    const processedTableName = validateString(table_name, "Table Name", 2, 30);
    const processedServedBy = validateString(
      served_by,
      "Served_by staff name",
      2,
      30
    );

    let memberDetails = null;
    if (member) {
      if (member?.length !== 11) {
        throw createError(400, "Mobile number should be 11 characters");
      }
      if (!validator.isMobilePhone(member, "any")) {
        throw createError(400, "Invalid mobile number");
      }

      const existingMember = await membersCollection.findOne({
        $and: [{ brand: user?.brand_id }, { mobile: member }],
      });

      if (!existingMember) {
        throw createError(400, "Member not found with this number");
      }
      memberDetails = existingMember;
    }

    const totalBillNumber = parseFloat(total_bill);
    let totalDiscount = 0;
    if (total_discount) {
      totalDiscount = parseFloat(total_discount);
    }

    const count = await soldInvoiceCollection.countDocuments();
    const generateCode = crypto.randomBytes(16).toString("hex");

    const newInvoice = {
      invoice_id: count + 1 + "-" + generateCode,
      brand: user?.brand?.brand_id,
      table_name: processedTableName,
      served_by: processedServedBy,
      member: memberDetails ? memberDetails?.mobile : null,
      items: items,
      total_bill: totalBillNumber,
      total_discount: totalDiscount,
      createdAt: new Date(),
      createdBy: user?.user_id,
    };

    const result = await soldInvoiceCollection.insertOne(newInvoice);
    if (!result?.insertedId) {
      throw createError(500, "Sold invoice not added");
    }

    // edit member if member ship found
    if (memberDetails) {
      const updateFields = {
        $inc: {
          total_spent: totalBillNumber,
          total_discount: totalDiscount,
        },
        $push: {
          invoices: {
            invoice_id: newInvoice.invoice_id,
            createdAt: newInvoice?.createdAt,
            bill: totalBillNumber,
            discount: totalDiscount,
          },
        },
      };

      await membersCollection.updateOne(
        { _id: new ObjectId(memberDetails?._id) },
        updateFields
      );
    }

    res.status(200).send({
      success: true,
      message: "Sold invoice added",
      data: newInvoice,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSoldInvoiceById = async (req, res, next) => {
  const { invoice_id } = req.params;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again");
    }
    if (invoice_id?.length < 33) {
      throw createError(400, "Invalid invoice id");
    }

    const result = await soldInvoiceCollection.findOne({
      invoice_id: invoice_id,
    });
    if (!result) {
      throw createError(404, "Sold invoice not found");
    }

    res.status(200).send({
      success: true,
      message: "Sold invoice retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSoldInvoices = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { date, start_date, end_date, month } = req.query;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit);

  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    let query = { brand: user?.brand_id };

    if (user?.role === "super admin") {
      query = {};

      if (date) {
        if (
          !validator.isDate(date, { format: "YYYY-MM-DD", strictMode: true })
        ) {
          throw createError(
            400,
            "Invalid date format. Expected format: YYYY-MM-DD"
          );
        }
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }

      if (start_date && end_date) {
        if (
          !validator.isDate(start_date, {
            format: "YYYY-MM-DD",
            strictMode: true,
          })
        ) {
          throw createError(
            400,
            "Invalid start date format. Expected format: YYYY-MM-DD"
          );
        }
        if (
          !validator.isDate(end_date, {
            format: "YYYY-MM-DD",
            strictMode: true,
          })
        ) {
          throw createError(
            400,
            "Invalid end date format. Expected format: YYYY-MM-DD"
          );
        }
        const startOfDay = new Date(start_date);
        const endOfDay = new Date(end_date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }
      if (month) {
        if (!validator.isISO8601(month, { strict: true })) {
          throw createError(
            400,
            "Invalid month format. Expected format: YYYY-MM"
          );
        }
        const startOfMonth = new Date(month);
        startOfMonth.setUTCDate(1);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
        endOfMonth.setUTCDate(0);
        endOfMonth.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      }
    } else {
      if (date) {
        if (
          !validator.isDate(date, { format: "YYYY-MM-DD", strictMode: true })
        ) {
          throw createError(
            400,
            "Invalid date format. Expected format: YYYY-MM-DD"
          );
        }
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }

      if (start_date && end_date) {
        if (
          !validator.isDate(start_date, {
            format: "YYYY-MM-DD",
            strictMode: true,
          })
        ) {
          throw createError(
            400,
            "Invalid start date format. Expected format: YYYY-MM-DD"
          );
        }
        if (
          !validator.isDate(end_date, {
            format: "YYYY-MM-DD",
            strictMode: true,
          })
        ) {
          throw createError(
            400,
            "Invalid end date format. Expected format: YYYY-MM-DD"
          );
        }
        const startOfDay = new Date(start_date);
        const endOfDay = new Date(end_date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }

      if (month) {
        if (!validator.isISO8601(month, { strict: true })) {
          throw createError(
            400,
            "Invalid month format. Expected format: YYYY-MM"
          );
        }
        const startOfMonth = new Date(month);
        startOfMonth.setUTCDate(1);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
        endOfMonth.setUTCDate(0);
        endOfMonth.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    const soldInvoicesQuery = soldInvoiceCollection.find(query);

    if (limit) {
      soldInvoicesQuery.limit(limit).skip((page - 1) * limit);
    }

    const soldInvoices = await soldInvoicesQuery.toArray();
    const count = await soldInvoiceCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Sold invoices retrieved successfully",
      data_found: count,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        previousPage: page > 1 ? page - 1 : null,
        nextPage: page < Math.ceil(count / limit) ? page + 1 : null,
      },
      data: soldInvoices,
    });
  } catch (error) {
    next(error);
  }
};
