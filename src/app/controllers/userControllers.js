import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  brandsCollection,
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
      brand_logo: { id: "", url: "" },
      contact: { mobile1: "", mobile2: "" },
      payment_info: {
        payment_invoices: [],
      },
      subscription_info: {
        last_payment: "",
        expiresAt: "",
        subscription_expired: true,
      },
      contacts: {
        mobile1: "",
        mobile2: "",
      },
      selected_plan: {
        id: "",
        name: "",
      },
      createdAt: new Date(),
      created_by: count + 1 + "-" + generateUserCode,
    };

    const newUser = {
      user_id: count + 1 + "-" + generateUserCode,
      name: processedName,
      avatar: { id: "", url: "" },
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
      "15m"
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
    if (!user.email_verified) {
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
    if (user.banned_user) {
      return next(
        createError.Unauthorized("You are banned. Please contact authority")
      );
    }

    // check user removed or not
    if (user.deleted_user) {
      return next(
        createError.Unauthorized("You are deleted. Please contact authority")
      );
    }
    const loggedInUser = {
      user_id: user.user_id,
      brand_id: user.brand_id,
      role: user.role,
    };

    // const brand = await brandsCollection.findOne({ brand_id: user?.brand_id });
    // if (loggedInUser?.role !== "super admin") {
    //   if (!brand) {
    //     throw createError(400, "Something wrong. Login again");
    //   }
    // }

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

export const handleGetUsers = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;

  const search = req.query.search || "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit);
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again.");
    }
    const regExSearch = new RegExp(".*" + search + ".*", "i");

    let query;

    if (
      user?.role != "super admin" &&
      user?.role != "admin" &&
      user?.role != "chairman"
    ) {
      throw createError(404, "Forbidden access. Only authority can access");
    }

    if (user?.role == "super admin") {
      if (search) {
        query = {
          $or: [
            { name: regExSearch },
            { mobile: regExSearch },
            { email: regExSearch },
            { username: regExSearch },
          ],
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
          ],
        };
      } else {
        query = { brand_id: user?.brand_id };
      }
    }

    let sortCriteria = { name: 1 };
    const users = await usersCollection
      .find(query)
      .sort(sortCriteria)
      .limit(limit)
      .skip((page - 1) * limit)
      .toArray();

    const count = await usersCollection.countDocuments(query);
    res.status(200).send({
      success: true,
      message: "Users retrieved successfully",
      data_found: count,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        previousPage: page - 1 > 0 ? page - 1 : null,
        nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
      },
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
  const { name, email, mobile, password, role } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again");
    }
    if (user?.role !== "admin" && user?.role !== "chairman") {
      throw createError(404, "Forbidden access. Only authority can access");
    }

    requiredField(name, "Name is required");
    requiredField(email, "Email is required");
    requiredField(mobile, "Mobile number is required");
    requiredField(password, "Password is required");
    requiredField(role, "Role is required");

    const processedName = validateString(name, "Name", 3, 30);
    const processedEmail = email?.toLowerCase();
    const processedRole = validateString(role, "Role", 3, 10);

    if (!validator.isEmail(processedEmail)) {
      throw createError(400, "Invalid email address");
    }

    if (mobile?.length !== 11) {
      throw createError(400, "Mobile number must be 11 characters");
    }

    if (!validator.isMobilePhone(mobile, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const allowedRoles = ["chairman", "admin", "regular"];

    if (!allowedRoles.includes(processedRole)) {
      throw createError(
        400,
        "Invalid role. Only chairman, admin, regular are allowed"
      );
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

    const count = await usersCollection.countDocuments();
    const generateUserCode = crypto.randomBytes(16).toString("hex");

    const newUser = {
      user_id: count + 1 + "-" + generateUserCode,
      name: processedName,
      avatar: "",
      email: processedEmail,
      username: generateUsername,
      brand_id: user?.brand_id,
      mobile: mobile,
      password: hashedPassword,
      role: processedRole,
      banned_user: false,
      deleted_user: false,
      email_verified: false,
      mobile_verified: false,
      createdAt: new Date(),
    };

    const userResult = await usersCollection.insertOne(newUser);
    if (!userResult?.insertedId) {
      throw createError(500, "Can't create user try again");
    }

    const token = await createJWT(
      {
        user_id: count + 1 + "-" + generateUserCode,
      },
      jwtSecret,
      "15m"
    );

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
      message: "New user created successfully for maintain brand",
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
