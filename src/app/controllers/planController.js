import createError from "http-errors";
import { requiredField } from "../helpers/requiredField.js";
import { validateString } from "../helpers/validateString.js";
import crypto from "crypto";
import {
  brandsCollection,
  planPurchaseCollection,
  plansCollection,
  removedUsersCollection,
  usersCollection,
} from "../collections/collections.js";
import { removedUserChecker } from "../helpers/removedUserChecker.js";
// import { CronJob } from "cron";

export const handleAddPlan = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const {
    plan_name,
    description,
    price,
    features,
    limitations,
    user_limit,
    terms_and_conditions,
  } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (user?.role !== "super admin") {
      throw createError(403, "Forbidden access. Only authority can access");
    }

    requiredField(plan_name, "Plan name is required");
    requiredField(description, "Description is required");
    requiredField(price, "Price is required");
    requiredField(user_limit, "User limit is required");
    requiredField(features, "Features is required");
    requiredField(limitations, "Limitations is required");
    requiredField(terms_and_conditions, "Terms and conditions is required");

    const processedPlanName = validateString(plan_name, "Plan Name", 2, 20);
    const processedDescription = validateString(
      description,
      "Description",
      2,
      500
    );
    const processedFeatures = validateString(features, "Features", 2, 500);
    const processedLimitations = validateString(
      limitations,
      "Limitations",
      2,
      500
    );
    const processedTermsAndConditions = validateString(
      terms_and_conditions,
      "Terms_and_conditions",
      2,
      1000
    );

    const planPrice = parseFloat(price);
    if (planPrice <= 0 || isNaN(planPrice)) {
      throw createError(400, "Plan price must be a positive number");
    }
    const userLimit = parseFloat(user_limit);
    if (userLimit <= 0 || isNaN(userLimit)) {
      throw createError(400, "User limit must be a positive number");
    }

    const generateCode = crypto.randomBytes(12).toString("hex");
    const newPlan = {
      plan_id: generateCode,
      plan_name: processedPlanName,
      description: processedDescription,
      duration: "monthly",
      price: planPrice,
      user_limit: userLimit,
      currency: "BDT",
      features: processedFeatures,
      limitations: processedLimitations,
      terms_and_conditions: processedTermsAndConditions,
      createdAt: new Date(),
      createdBy: user?.user_id,
    };

    await plansCollection.insertOne(newPlan);

    res.status(200).send({
      success: true,
      message: "Plan added successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetPlans = async (req, res, next) => {
  try {
    const plans = await plansCollection.find().sort({ price: 1 }).toArray();
    res.status(200).send({
      success: true,
      message: "Plans retrieved successfully",
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetPlan = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (id?.length < 24) {
      throw createError(400, "Invalid id");
    }
    const plan = await plansCollection.findOne({ plan_id: id });
    if (!plan) {
      throw createError(404, "Plan not found");
    }
    res.status(200).send({
      success: true,
      message: "Plan retrieved successfully",
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

export const handlePurchasePlan = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { amount, plan_id } = req.body;

  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);

    requiredField(amount, "Amount is required");
    requiredField(plan_id, "Plan is required");

    const existingUser = await usersCollection.findOne(
      { user_id: user?.user_id },
      { projection: { brand_id: 1, _id: 0 } }
    );

    if (!existingUser) {
      throw createError(400, "User not found");
    }
    const existingBrand = await brandsCollection.findOne(
      { brand_id: user?.brand_id },
      {
        projection: {
          brand_id: 1,
          _id: 0,
          subscription_info: 1,
          selected_plan: 1,
        },
      }
    );

    if (!existingBrand) {
      throw createError(400, "Brand not found");
    }

    if (plan_id?.length < 24) {
      throw createError(400, "Invalid plan id");
    }

    const plan = await plansCollection.findOne(
      { plan_id },
      { projection: { price: 1, plan_name: 1, _id: 0 } }
    );

    if (!plan || plan?.price > amount) {
      throw createError(
        400,
        `Payment amount not right the required amount is: ${plan?.price} + vat + tax`
      );
    }

    const newPurchase = {
      user_id: user?.user_id,
      brand_id: existingUser?.brand_id,
      amount: parseFloat(amount),
      createdAt: new Date(),
    };

    const purchase = await planPurchaseCollection.insertOne(newPurchase);
    if (!purchase?.insertedId) {
      throw createError(400, "Failed to purchase plan");
    }

    const currentDate = new Date();
    const futureDate = new Date(
      currentDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    const updateResult = await brandsCollection.updateOne(
      { brand_id: existingUser?.brand_id },
      {
        $set: {
          selected_plan: { id: plan_id, name: plan?.plan_name },
          subscription_info: {
            status: true,
            previous_payment_amount: newPurchase?.amount,
            previous_payment_time: new Date(),
            end_time: futureDate,
          },
        },
      }
    );

    if (updateResult?.modifiedCount < 1) {
      throw createError(500, "Something went wrong");
    }

    res.status(200).send({
      success: true,
      message: "Plan purchased successfully",
    });
  } catch (error) {
    next(error);
  }
};

// const updatePlanPrices = async () => {
//   const percentageIncrease = 0.05; // Increase by 5%
//   const plans = await plansCollection.find().toArray();

//   const updatePromises = plans.map(async (plan) => {
//     const newPrice = plan.price * (1 + percentageIncrease);
//     await plansCollection.updateOne(
//       { plan_id: plan.plan_id },
//       { $set: { price: newPrice } }
//     );
//   });

//   await Promise.all(updatePromises);
//   console.log("Plan prices updated");
// };

// const priceUpdateJob = new CronJob("*/10 * * * * *", updatePlanPrices);
// priceUpdateJob.start();
