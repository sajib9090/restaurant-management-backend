import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  brandsCollection,
  plansCollection,
  removedUsersCollection,
  usersCollection,
} from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import slugify from "slugify";
import validator from "validator";
import { requiredField } from "../helpers/requiredField.js";
import { duplicateChecker } from "../helpers/duplicateChecker.js";
import bcrypt from "bcryptjs";
import createJWT from "../helpers/createJWT.js";
import {
  clientURL,
  frontEndURL,
  jwtAccessToken,
  jwtRefreshToken,
  jwtSecret,
} from "../../../important.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { emailWithNodeMailer } from "../helpers/email.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../helpers/cloudinary.js";
import { removedUserChecker } from "../helpers/removedUserChecker.js";

export const handleCreateUser = async (req, res, next) => {
  const { name, email, brand_name, mobile, password } = req.body;
  try {
    requiredField(name, "Name is required");
    requiredField(email, "Email is required");
    requiredField(brand_name, "Brand_name is required");
    requiredField(mobile, "Mobile number is required");
    requiredField(password, "Password is required");

    const processedName = validateString(name, "Name", 3, 30);
    const processedBrandName = validateString(brand_name, "Brand name", 3, 30);
    const processedEmail = email?.toLowerCase();

    if (!validator.isEmail(processedEmail)) {
      throw createError(400, "Invalid email address");
    }

    if (mobile?.length !== 11) {
      throw createError(400, "Mobile number must be 11 characters");
    }

    if (!validator.isMobilePhone(mobile, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const generateUsername = processedEmail?.split("@")[0];

    await duplicateChecker(
      usersCollection,
      "email",
      processedEmail,
      "Email already exists. Please login"
    );

    await duplicateChecker(
      usersCollection,
      "mobile",
      mobile,
      "Mobile number already exists. Please login"
    );

    const trimmedPassword = password.replace(/\s/g, "");
    if (trimmedPassword.length < 8 || trimmedPassword.length > 30) {
      throw createError(
        400,
        "Password must be at least 8 characters long and not more than 30 characters long"
      );
    }

    if (!/[a-z]/.test(trimmedPassword) || !/\d/.test(trimmedPassword)) {
      throw createError(
        400,
        "Password must contain at least one letter (a-z) and one number"
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);

    const brandCount = await brandsCollection.countDocuments();
    const generateBrandCode = crypto.randomBytes(16).toString("hex");

    const count = await usersCollection.countDocuments();
    const generateUserCode = crypto.randomBytes(16).toString("hex");

    const brandSlug = slugify(processedBrandName);

    const newBrand = {
      brand_id: brandCount + 1 + "-" + generateBrandCode,
      brand_name: processedBrandName,
      brand_slug: brandSlug,
      brand_logo: { id: null, url: null },
      address: { location: null, sub_district: null, district: null },
      contact: { mobile1: null, mobile2: null },
      subscription_info: {
        status: false,
        previous_payment_amount: null,
        previous_payment_time: null,
        end_time: null,
        free_trial: {
          status: false,
          start_time: null,
          end_time: null,
          trial_over: false,
        },
      },
      selected_plan: {
        id: null,
        name: null,
      },
      createdAt: new Date(),
      created_by: count + 1 + "-" + generateUserCode,
    };

    const newUser = {
      user_id: count + 1 + "-" + generateUserCode,
      name: processedName,
      avatar: { id: null, url: null },
      email: processedEmail,
      username: generateUsername,
      brand_id: newBrand?.brand_id,
      mobile: mobile,
      password: hashedPassword,
      role: "chairman",
      banned_user: false,
      deleted_user: false,
      email_verified: false,
      mobile_verified: false,
      createdAt: new Date(),
    };

    const token = await createJWT(
      {
        user_id: count + 1 + "-" + generateUserCode,
      },
      jwtSecret,
      "5m"
    );

    const brandResult = await brandsCollection.insertOne(newBrand);
    const userResult = await usersCollection.insertOne(newUser);

    if (!brandResult?.insertedId && !userResult?.insertedId) {
      await usersCollection.deleteOne({ user_id: newUser?.user_id });
      await brandsCollection.deleteOne({ brand_id: newBrand?.brand_id });
      throw createError(500, "Can't create user try again");
    }

    if (!brandResult?.insertedId) {
      await usersCollection.deleteOne({ user_id: newUser?.user_id });
      throw createError(500, "Can't create user try again");
    }

    if (!userResult?.insertedId) {
      await brandsCollection.deleteOne({ brand_id: newBrand?.brand_id });
      throw createError(500, "Can't create user try again");
    }

    //prepare email
    const emailData = {
      email,
      subject: "Account Creation Confirmation",
      html: `<h2 style="text-transform: capitalize;">Hello ${processedName}!</h2>
      <p>Please click here to <a href="${clientURL}/api/v2/users/verify/${token}">activate your account</a></p>
      <p>This link will expires in 5 minutes</p>`,
    };

    // send email with nodemailer
    try {
      await emailWithNodeMailer(emailData);
    } catch (emailError) {
      next(createError(500, "Failed to send verification email"));
    }

    res.status(200).send({
      success: true,
      message: `Please go to your email at- ${email} and complete registration process`,
    });
  } catch (error) {
    next(error);
  }
};

export const handleActivateUserAccount = async (req, res, next) => {
  const token = req.params.token;
  try {
    if (!token) {
      throw createError(404, "Credential not found");
    }

    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded) {
      throw createError(404, "Invalid credential");
    }

    const existingUser = await usersCollection.findOne({
      user_id: decoded.user_id,
    });

    if (!existingUser) {
      throw createError(404, "User not found. Try again");
    }

    if (existingUser.email_verified) {
      return res.redirect(`${frontEndURL}/login`);
    }

    const updateUser = await usersCollection.updateOne(
      { user_id: existingUser.user_id },
      {
        $set: {
          email_verified: true,
        },
      }
    );

    if (updateUser.modifiedCount === 0) {
      throw createError(500, "Something went wrong. Please try again");
    }

    return res.redirect(`${frontEndURL}/login`);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.redirect(`${frontEndURL}/expired-credentials`);
    }
    next(error);
  }
};

export const handleLoginUser = async (req, res, next) => {
  // get data
  const { username_email_mobile, password } = req.body;
  try {
    // validate
    if (!username_email_mobile || !password) {
      throw createError(
        400,
        "Username or email or mobile and password are required"
      );
    }

    const stringData = username_email_mobile
      ?.trim()
      .replace(/\s+/g, "")
      .toLowerCase();

    if (
      username_email_mobile?.length > 50 ||
      username_email_mobile?.length < 3
    ) {
      throw createError(400, "Username, email, or mobile should be valid");
    }

    const trimmedPassword = password.replace(/\s/g, "");

    if (trimmedPassword.length < 8 || trimmedPassword.length > 30) {
      throw createError(
        400,
        "Password must be at least 8 characters long and not more than 30 characters long"
      );
    }

    if (!/[a-z]/.test(trimmedPassword) || !/\d/.test(trimmedPassword)) {
      throw createError(
        400,
        "Password must contain at least one letter (a-z) and one number"
      );
    }

    // check user exist ot not
    const user = await usersCollection.findOne({
      $or: [
        { username: stringData },
        { email: stringData },
        { mobile: stringData },
      ],
    });

    if (!user) {
      return next(
        createError.BadRequest(
          "Invalid username, email address, or mobile. Not found"
        )
      );
    }

    // Match password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(createError.Unauthorized("Invalid Password"));
    }

    // check email verified or not
    if (user?.email && !user?.email_verified) {
      const token = await createJWT(
        {
          user_id: user.user_id,
        },
        jwtSecret,
        "5m"
      );

      const email = user.email;
      const emailData = {
        email,
        subject: "Account Creation Confirmation",
        html: `<h2 style="text-transform: capitalize;">Hello ${user.name}!</h2>
        <p>Please click here to <a href="${clientURL}/api/v2/users/verify/${token}">activate your account</a></p>
        <p>This link will expire in 5 minutes</p>`,
      };

      try {
        await emailWithNodeMailer(emailData);
      } catch (emailError) {
        return next(createError(500, "Failed to send verification email"));
      }

      return next(
        createError.Unauthorized(
          `You are not verified. Please check your email at- ${user.email} and verify your account.`
        )
      );
    }

    // check user band or not
    if (user?.banned_user) {
      return next(
        createError.Unauthorized("You are banned. Please contact authority")
      );
    }

    // check user removed or not
    if (user?.deleted_user) {
      return next(
        createError.Unauthorized("You are deleted. Please contact authority")
      );
    }
    const loggedInUser = {
      user_id: user?.user_id,
      brand_id: user?.brand_id,
      role: user?.role,
    };

    const userWithBrand = { ...loggedInUser };

    const accessToken = await createJWT(userWithBrand, jwtAccessToken, "10m");

    const refreshToken = await createJWT(userWithBrand, jwtRefreshToken, "7d");
    res.cookie("refreshToken", refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.status(200).send({
      success: true,
      message: "User logged in successfully",
      data: userWithBrand,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const handleLogoutUser = async (req, res, next) => {
  try {
    const options = {
      httpOnly: true,
      secure: true,
    };
    // console.log(req.user);
    // res.clearCookie("accessToken", options);
    res.clearCookie("refreshToken", options);
    res.status(200).send({
      success: true,
      message: "User logout successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetUsers = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const search = req.query.search || "";
  const brandFilter = req.query.brand || "";
  const page = Number(req.query.page) || 1;
  const limit = req.query.limit ? Number(req.query.limit) : null;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again.");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    const regExSearch = new RegExp(".*" + search + ".*", "i");

    if (
      user?.role != "super admin" &&
      user?.role != "admin" &&
      user?.role != "chairman"
    ) {
      throw createError(404, "Forbidden access. Only authority can access");
    }

    let query;
    if (user?.role == "super admin") {
      if (search) {
        query = {
          $or: [
            { name: regExSearch },
            { mobile: regExSearch },
            { email: regExSearch },
            { username: regExSearch },
            { role: regExSearch },
            { user_id: regExSearch },
          ],
        };
      } else if (brandFilter) {
        query = {
          brand_id: brandFilter,
        };
      } else {
        query = {};
      }
    } else {
      if (search) {
        query = {
          $and: [
            {
              brand_id: user?.brand_id,
            },
          ],
          $or: [
            { name: regExSearch },
            { mobile: regExSearch },
            { email: regExSearch },
            { username: regExSearch },
            { role: regExSearch },
          ],
        };
      } else {
        query = { brand_id: user?.brand_id };
      }
    }

    let sortCriteria = { name: 1 };

    let users;
    if (user?.role === "super admin") {
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: "brands",
            localField: "brand_id",
            foreignField: "brand_id",
            as: "brand_info",
          },
        },
        { $unwind: "$brand_info" },
        {
          $project: {
            _id: 1,
            user_id: 1,
            name: 1,
            avatar: 1,
            email: 1,
            username: 1,
            mobile: 1,
            brand_id: 1,
            role: 1,
            createdAt: 1,
            banned_user: 1,
            email_verified: 1,
            "brand_info.brand_id": 1,
            "brand_info.brand_name": 1,
            "brand_info.brand_logo": 1,
          },
        },
        { $sort: sortCriteria },
      ];
      if (limit) {
        pipeline.push({ $skip: (page - 1) * limit });
        pipeline.push({ $limit: limit });
      }
      users = await usersCollection.aggregate(pipeline).toArray();
    } else {
      const findQuery = usersCollection.find(query).sort(sortCriteria);

      if (limit) {
        findQuery.limit(limit).skip((page - 1) * limit);
      }

      users = await findQuery.toArray();
    }

    const count = await usersCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Users retrieved successfully",
      data_found: count,
      pagination: limit
        ? {
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            previousPage: page - 1 > 0 ? page - 1 : null,
            nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
          }
        : null,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCurrentUser = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Login again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    const currentUser = await usersCollection.findOne({
      user_id: user?.user_id,
    });
    const brand = await brandsCollection.findOne({ brand_id: user?.brand_id });

    if (currentUser) {
      delete currentUser.password;
    }
    const response = {
      ...currentUser,
      brand,
    };
    res.status(200).send({
      success: true,
      message: "Current user retrieved successfully with brand info",
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetUser = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid params id");
    }

    const existUser = await usersCollection.findOne({
      $and: [{ _id: new ObjectId(id) }, { brand_id: user?.brand_id }],
    });
    if (!existUser) {
      throw createError(404, "User not found");
    }

    const brand = await brandsCollection.findOne({
      brand_id: user?.brand_id,
    });

    const { password, ...userWithoutPassword } = existUser;

    res.status(200).send({
      success: true,
      message: "User retrieved successfully",
      data: {
        ...userWithoutPassword,
        brand,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleRefreshToken = async (req, res, next) => {
  const oldRefreshToken = req.cookies.refreshToken;
  try {
    if (!oldRefreshToken) {
      throw createError(404, "Refresh token not found. Login first");
    }
    //verify refresh token
    const decodedToken = jwt.verify(oldRefreshToken, jwtRefreshToken);

    if (!decodedToken) {
      throw createError(401, "Invalid refresh token. Please Login");
    }

    // if token validation success generate new access token
    const accessToken = await createJWT(
      { user: decodedToken },
      jwtAccessToken,
      "10m"
    );
    // Update req.user with the new decoded user information
    req.user = decodedToken.user;

    res.status(200).send({
      success: true,
      message: "New access token generate successfully",
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const handleAddBrandMaintainUser = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { name, username, mobile, password, role } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (user?.role !== "admin" && user?.role !== "chairman") {
      throw createError(404, "Forbidden access. Only authority can access");
    }

    requiredField(name, "Name is required");
    requiredField(username, "Username is required");
    requiredField(mobile, "Mobile number is required");
    requiredField(password, "Password is required");
    requiredField(role, "Role is required");

    const processedName = validateString(name, "Name", 3, 30);
    const processedUsername = validateString(username, "Username", 3, 30);
    const processedRole = validateString(role, "Role", 3, 10);

    const brandInfo = await brandsCollection.findOne(
      { brand_id: user?.brand_id },
      { projection: { selected_plan: 1, _id: 0 } }
    );

    if (!brandInfo?.selected_plan?.id) {
      throw createError(
        400,
        "Please select a plan before adding a user to your brand."
      );
    }

    const selectedPlanInfo = await plansCollection.findOne(
      { plan_id: brandInfo?.selected_plan?.id },
      { projection: { user_limit: 1, _id: 0 } }
    );

    const brandUsers = await usersCollection.countDocuments({
      brand_id: user?.brand_id,
    });

    if (brandUsers >= selectedPlanInfo?.user_limit) {
      throw createError(
        400,
        `You have reached your user limit. Please upgrade your plan to add more users.`
      );
    }

    if (mobile?.length !== 11) {
      throw createError(400, "Mobile number must be 11 characters");
    }

    if (!validator.isMobilePhone(mobile, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const allowedRoles = ["admin", "regular"];

    if (!allowedRoles.includes(processedRole)) {
      throw createError(
        400,
        "Invalid role. Only admin and regular are allowed"
      );
    }

    await duplicateChecker(
      usersCollection,
      "username",
      processedUsername,
      "Username already exists. Please login"
    );

    await duplicateChecker(
      usersCollection,
      "mobile",
      mobile,
      "Mobile number already exists. Please login"
    );

    const trimmedPassword = password.replace(/\s/g, "");
    if (trimmedPassword.length < 8 || trimmedPassword.length > 30) {
      throw createError(
        400,
        "Password must be at least 8 characters long and not more than 30 characters long"
      );
    }

    if (!/[a-z]/.test(trimmedPassword) || !/\d/.test(trimmedPassword)) {
      throw createError(
        400,
        "Password must contain at least one letter (a-z) and one number"
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);

    const count = await usersCollection.countDocuments();
    const generateUserCode = crypto.randomBytes(16).toString("hex");

    const newUser = {
      user_id: count + 1 + "-" + generateUserCode,
      name: processedName,
      avatar: { id: null, url: null },
      username: processedUsername,
      brand_id: user?.brand_id,
      mobile: mobile,
      password: hashedPassword,
      role: processedRole,
      banned_user: false,
      deleted_user: false,
      mobile_verified: false,
      createdAt: new Date(),
    };

    const userResult = await usersCollection.insertOne(newUser);
    if (!userResult?.insertedId) {
      throw createError(500, "Can't create user try again");
    }

    res.status(200).send({
      success: true,
      message: "New user created successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateUserAvatar = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const userId = req.params.id;
  const bufferFile = req.file.buffer;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (userId?.length < 33) {
      throw createError(400, "Invalid id");
    }

    if (!bufferFile) {
      throw createError(400, "Avatar is required");
    }

    const existingUser = await usersCollection.findOne({
      user_id: userId,
    });

    if (!existingUser) {
      throw createError(404, "User not found");
    }

    if (
      existingUser?.avatar &&
      existingUser?.avatar?.id &&
      existingUser?.avatar?.url
    ) {
      await deleteFromCloudinary(existingUser.avatar.id);
    }

    const avatar = await uploadOnCloudinary(bufferFile);

    if (!avatar?.public_id) {
      a;
      throw createError(500, "Something went wrong. Avatar not updated");
    }

    await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(existingUser._id) },
      { $set: { avatar: { id: avatar.public_id, url: avatar.url } } },
      { returnOriginal: false }
    );

    res.status(200).send({
      success: true,
      message: "Avatar updated",
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateUserNameAndMobile = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { name, username, mobile } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    const existingUser = await usersCollection.findOne(
      {
        user_id: user?.user_id,
      },
      { projection: { name: 1, username: 1, mobile: 1, _id: 0 } }
    );

    if (!existingUser) {
      throw createError(404, "User not found");
    }

    let updateFields = {};

    if (name && existingUser?.name !== name) {
      const processedName = validateString(name, "Name", 2, 100);
      updateFields.name = processedName;
    }
    let processedUsername;
    if (username) {
      const inpUsername = validateString(username, "Username", 4, 100);
      processedUsername = validateString(username, "Username", 4, 100).replace(
        /\s+/g,
        ""
      );
    }
    if (processedUsername && existingUser?.username !== processedUsername) {
      const existingUsername = await usersCollection.findOne({
        username: processedUsername,
      });
      if (existingUsername) {
        throw createError(400, "Username already exists");
      }
      updateFields.username = processedUsername;
    }

    if (mobile && existingUser?.mobile !== mobile) {
      if (mobile?.length !== 11) {
        throw createError(400, "Mobile number must be 11 characters");
      }

      if (!validator.isMobilePhone(mobile, "any")) {
        throw createError(400, "Invalid mobile number");
      }

      const existingMobile = await usersCollection.findOne({ mobile: mobile });
      if (existingMobile) {
        throw createError(400, "Mobile number already exists");
      }

      updateFields.mobile = mobile;
    }

    if (Object.keys(updateFields).length === 0)
      throw createError(400, "Nothing available for update");

    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      const updateResult = await usersCollection.updateOne(
        { user_id: user?.user_id },
        { $set: updateFields }
      );

      if (updateResult.modifiedCount !== 1) {
        throw createError(500, "Failed to update user");
      }
    }

    res.status(200).send({
      success: true,
      message: "User updated",
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteUsers = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (
      user?.role !== "super admin" &&
      user?.role !== "chairman" &&
      user?.role !== "admin"
    ) {
      throw createError(
        403,
        "Forbidden access. Only chairman and admin can access"
      );
    }
    if (id?.length < 32) {
      throw createError(400, "Invalid id");
    }

    const existingUser = await usersCollection.findOne(
      {
        $and: [{ user_id: id }, { brand_id: user?.brand_id }],
      },
      { projection: { role: 1, brand_id: 1, user_id: 1, _id: 0, avatar: 1 } }
    );

    if (!existingUser) {
      throw createError(404, "User not found");
    }

    if (existingUser?.role === "chairman" && user?.role === "admin") {
      throw createError(403, "You have no right to delete your senior");
    }

    // todo add error validation if occurred
    if (
      existingUser?.avatar &&
      existingUser?.avatar?.id &&
      existingUser?.avatar?.url
    ) {
      const result = await deleteFromCloudinary(existingUser.avatar.id);
      if (result?.result !== "ok") {
        throw createError(500, "Something went wrong. Please try again");
      }
    }

    const deleteUser = await usersCollection.deleteOne({
      user_id: existingUser?.user_id,
    });

    if (deleteUser?.deletedCount === 0) {
      throw createError(500, "User can't deleted. Try again");
    }

    const newDeletedUser = {
      user_id: existingUser?.user_id,
      brand_id: existingUser?.brand_id,
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    await removedUsersCollection.insertOne(newDeletedUser);

    res.status(200).send({
      success: true,
      message: "User deleted",
    });
  } catch (error) {
    next(error);
  }
};

export const handleChangeOwnPassword = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Please log in again.");
    }
    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (oldPassword === newPassword) {
      throw createError(
        400,
        "New password cannot be the same as the old password. Please choose a different password."
      );
    }

    const trimmedOldPassword = oldPassword.replace(/\s/g, "");
    const trimmedNewPassword = newPassword.replace(/\s/g, "");

    if (trimmedOldPassword.length < 8 || trimmedOldPassword.length > 30) {
      throw createError(
        400,
        "Old password must be at least 8 characters long and not more than 30 characters long."
      );
    }

    if (!/[a-z]/.test(trimmedOldPassword) || !/\d/.test(trimmedOldPassword)) {
      throw createError(
        400,
        "Old password must contain at least one letter (a-z) and one number."
      );
    }

    if (trimmedNewPassword.length < 8 || trimmedNewPassword.length > 30) {
      throw createError(
        400,
        "New password must be at least 8 characters long and not more than 30 characters long."
      );
    }

    if (!/[a-z]/.test(trimmedNewPassword) || !/\d/.test(trimmedNewPassword)) {
      throw createError(
        400,
        "New password must contain at least one letter (a-z) and one number."
      );
    }

    if (newPassword !== confirmNewPassword) {
      throw createError(
        400,
        "New password and confirm new password do not match. Please ensure both passwords are identical."
      );
    }

    const existingUser = await usersCollection.findOne(
      {
        user_id: user?.user_id,
        brand_id: user?.brand_id,
      },
      { projection: { password: 1, _id: 0, changed_password: 1 } }
    );
    if (!existingUser) {
      throw createError(404, "User not found.");
    }

    const isOldPasswordValid = await bcrypt.compare(
      trimmedOldPassword,
      existingUser.password
    );
    if (!isOldPasswordValid) {
      return next(createError.Unauthorized("Invalid old password."));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(trimmedNewPassword, salt);

    if (existingUser?.changed_password) {
      for (let previousHashedPassword of existingUser?.changed_password) {
        const isPreviousPassword = await bcrypt.compare(
          trimmedNewPassword,
          previousHashedPassword
        );
        if (isPreviousPassword) {
          throw createError(
            400,
            "You cannot reuse a previous password. Please choose a new password."
          );
        }
      }
    }

    const updateResult = await usersCollection.updateOne(
      { user_id: user?.user_id },
      {
        $set: { password: hashedNewPassword },
        $push: {
          changed_password: {
            $each: [existingUser.password],
            $slice: -3,
          },
        },
      }
    );

    if (updateResult?.modifiedCount == 0) {
      throw createError(500, "Something went wrong. Try again");
    }

    res.status(200).send({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const handleChangeRoleAndPasswordByAuthority = async (
  req,
  res,
  next
) => {
  const user = req.user.user ? req.user.user : req.user;
  const { id } = req.params;
  const { role, password } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Please log in again.");
    }

    if (
      user?.role !== "super admin" &&
      user?.role !== "chairman" &&
      user?.role !== "admin"
    ) {
      throw createError(403, "Forbidden access. Only authority can access");
    }
    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);

    if (id?.length < 32) {
      throw createError(400, "Invalid Id");
    }

    const queryUser = await usersCollection.findOne(
      { user_id: id },
      { projection: { role: 1 } }
    );

    if (!queryUser) {
      throw createError(404, "User not found with this id");
    }

    if (
      queryUser?.role == "chairman" &&
      user?.role !== "chairman" &&
      user?.role !== "super admin"
    ) {
      throw createError(403, "Forbidden access. You can't edit your senior");
    }

    let updateFields = {};

    if (role) {
      const processedRole = validateString(role, "Role", 3, 10);
      const allowedRoles = ["admin", "regular"];
      if (!allowedRoles.includes(processedRole)) {
        throw createError(
          400,
          "Invalid role. Only admin and regular are allowed"
        );
      }

      if (processedRole == queryUser?.role) {
        throw createError(400, "The role is same as before");
      }

      updateFields.role = processedRole;
    }

    if (password) {
      const trimmedPassword = password.replace(/\s/g, "");
      if (trimmedPassword.length < 8 || trimmedPassword.length > 30) {
        throw createError(
          400,
          "Password must be at least 8 characters long and not more than 30 characters long"
        );
      }

      if (!/[a-z]/.test(trimmedPassword) || !/\d/.test(trimmedPassword)) {
        throw createError(
          400,
          "Password must contain at least one letter (a-z) and one number"
        );
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(trimmedPassword, salt);
      const processedPassword = hashedPassword;
      updateFields.password = processedPassword;
    }

    if (Object.keys(updateFields).length === 0) {
      throw createError(400, "No fields to update");
    }

    const updatedUser = await usersCollection.updateOne(
      { _id: new ObjectId(queryUser?._id) },
      { $set: updateFields }
    );

    if (updatedUser.modifiedCount === 0) {
      throw createError(500, "Something went wrong. Try again");
    }

    res.status(200).send({
      success: true,
      message: "User Updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
