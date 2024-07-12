import createError from "http-errors";

export const removedUserChecker = async (collectionName, key, value) => {
  const query = { [key]: value };
  const existingData = await collectionName.findOne(query);
  if (existingData) {
    throw createError(
      404,
      "Forbidden access. You are removed from your brand. Please login to try again."
    );
  }
};
