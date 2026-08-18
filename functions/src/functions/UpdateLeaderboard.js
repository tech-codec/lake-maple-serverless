const { app, output } = require("@azure/functions");
const { database } = require("../services/cosmosClient");

const leaderChangeQueueOutput = output.serviceBusQueue({
  queueName: process.env.LEADER_CHANGE_QUEUE || "leader-change-queue",
  connection: "SERVICE_BUS_CONNECTION",
});

app.cosmosDB("UpdateLeaderboard", {
  connection: "COSMOS_CONNECTION",

  databaseName: "LakeMapleDB",
  containerName: "fishCatches",

  leaseContainerName: "leases",
  createLeaseContainerIfNotExists: false,

  extraOutputs: [leaderChangeQueueOutput],

  handler: async (documents, context) => {
    context.log(
      `UpdateLeaderboard triggered with ${documents.length} document(s).`,
    );

    const leaderboardContainer = database.container("leaderboards");

    for (const fishCatch of documents) {
      try {
        const fishType = fishCatch.fishType?.trim();

        const weight = Number(fishCatch.weight);

        const contestantId = fishCatch.contestantId;

        if (!fishType || !contestantId || !Number.isFinite(weight)) {
          context.warn(`Skipping invalid catch ${fishCatch.id}`);

          continue;
        }

        context.log(`Evaluating ${fishType}: ${weight} kg`);

        const leaderboardId = fishType.toLowerCase().replace(/\s+/g, "-");

        let currentLeader = null;

        try {
          const response = await leaderboardContainer
            .item(leaderboardId, fishType)
            .read();

          currentLeader = response.resource;
        } catch (error) {
          if (error.code !== 404) {
            throw error;
          }
        }

        if (currentLeader && currentLeader.weight >= weight) {
          context.log(
            `Existing ${fishType} record remains at ${currentLeader.weight} kg.`,
          );

          continue;
        }

        const previousLeader = currentLeader
          ? {
              contestantId: currentLeader.contestantId,
              contestantEmail: currentLeader.contestantEmail,
              weight: currentLeader.weight,
            }
          : null;

        const contestantsContainer = database.container("contestants");

        const contestantQuery = {
          query: "SELECT TOP 1 * FROM c WHERE c.id = @id",
          parameters: [
            {
              name: "@id",
              value: contestantId,
            },
          ],
        };

        const { resources: contestants } = await contestantsContainer.items
          .query(contestantQuery)
          .fetchAll();

        if (contestants.length === 0) {
          context.warn(`Contestant ${contestantId} not found.`);

          continue;
        }

        const contestant = contestants[0];

        const leaderboardEntry = {
          id: leaderboardId,
          fishType,
          contestantId,
          contestantName: `${contestant.firstName} ${contestant.lastName}`,
          contestantEmail: contestant.email,
          weight,
          fishCatchId: fishCatch.id,
          updatedAt: new Date().toISOString(),
        };

        await leaderboardContainer.items.upsert(leaderboardEntry);

        context.log(
          `New ${fishType} leader: ${leaderboardEntry.contestantName} - ${weight} kg`,
        );

        if (previousLeader && previousLeader.contestantId !== contestantId) {
          const notification = {
            eventType: "LeaderboardRecordBroken",

            fishType,

            previousLeaderId: previousLeader.contestantId,

            previousLeaderEmail: previousLeader.contestantEmail,

            previousWeight: previousLeader.weight,

            newLeaderId: contestantId,

            newLeaderName: leaderboardEntry.contestantName,

            newWeight: weight,

            fishCatchId: fishCatch.id,

            changedAt: new Date().toISOString(),
          };

          context.extraOutputs.set(leaderChangeQueueOutput, notification);

          context.log(
            `Leader-change notification queued for ${previousLeader.contestantEmail}`,
          );
        }
      } catch (error) {
        context.error(`Failed to process catch ${fishCatch.id}`, error);

        throw error;
      }
    }
  },
});
