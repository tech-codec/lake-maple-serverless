const { app } = require("@azure/functions");
const crypto = require("crypto");
const { database } = require("../services/cosmosClient");
const { blobServiceClient } = require("../services/blobClient");

app.http("SubmitFishCatch", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "fish-catches",

  handler: async (request, context) => {
    context.log("SubmitFishCatch function started.");

    try {
      const formData = await request.formData();

      const contestantId = formData.get("contestantId")?.toString().trim();

      const fishType = formData.get("fishType")?.toString().trim();

      const weightRaw = formData.get("weight")?.toString().trim();

      const photo = formData.get("photo");

      if (!contestantId || !fishType || !weightRaw || !photo) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: "contestantId, fishType, weight, and photo are required.",
          },
        };
      }

      const weight = Number(weightRaw);

      if (!Number.isFinite(weight) || weight <= 0) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: "Weight must be a positive number.",
          },
        };
      }

      if (!photo.type || !photo.type.startsWith("image/")) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: "The uploaded proof must be an image.",
          },
        };
      }

      const catchId = crypto.randomUUID();

      const extension =
        photo.name && photo.name.includes(".")
          ? photo.name.split(".").pop()
          : "jpg";

      const blobName = `${contestantId}/${catchId}.${extension}`;

      const containerName = process.env.FISH_PHOTOS_CONTAINER || "fish-photos";

      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const photoBuffer = Buffer.from(await photo.arrayBuffer());

      await blockBlobClient.uploadData(photoBuffer, {
        blobHTTPHeaders: {
          blobContentType: photo.type,
        },
        metadata: {
          catchId,
          contestantId,
          fishType,
        },
      });

      const fishCatch = {
        id: catchId,
        contestantId,
        fishType,
        weight,
        photoBlobName: blobName,
        photoUrl: blockBlobClient.url,
        submittedAt: new Date().toISOString(),
        photoStatus: "uploaded",
        status: "submitted",
      };

      const container = database.container("fishCatches");

      const { resource } = await container.items.create(fishCatch);

      context.log(`Fish catch submitted: ${resource.id}`);

      return {
        status: 201,
        jsonBody: {
          success: true,
          message: "Fish catch submitted successfully.",
          fishCatch: resource,
        },
      };
    } catch (error) {
      context.error("SubmitFishCatch failed:", error);

      return {
        status: 500,
        jsonBody: {
          success: false,
          message:
            "An unexpected error occurred while submitting the fish catch.",
        },
      };
    }
  },
});
