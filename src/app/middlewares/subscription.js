import createError from "http-errors";
import rateLimit from "express-rate-limit";
import { brandsCollection } from "../collections/collections.js";

export const verifySubscription = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    const brand = await brandsCollection.findOne(
      { brand_id: user?.brand_id },
      { projection: { subscription_info: 1, brand_id: 1, _id: 0 } }
    );

    const endTimeDate = new Date(brand.subscription_info.end_time);
    const currentDate = new Date();

    const remainingDays = Math.ceil(
      (endTimeDate - currentDate) / (1000 * 60 * 60 * 24)
    );

    if (remainingDays < 1) {
      if (brand?.subscription_info?.status) {
        await brandsCollection.updateOne(
          { brand_id: brand?.brand_id },
          {
            $set: {
              "subscription_info.status": false,
            },
          }
        );
      }
      return res.status(403).send({
        status: false,
        message: `Your subscription is expired.`,
        // dueAmount: result?.total_due || "N/A",
      });
    }
    next();
  } catch (error) {
    return next(error);
  }
};
