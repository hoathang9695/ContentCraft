import express from "express";
import { ContentController } from "../controllers/content.controller";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import { storage } from "../storage";

const router = express.Router();
const contentController = new ContentController();

// Content routes
router.get("/", isAuthenticated, contentController.getAllContents);
router.get("/paginated", isAuthenticated, contentController.getPaginatedContents);
router.get("/:id", isAuthenticated, contentController.getContentById);
router.post("/", isAuthenticated, contentController.createContent);
router.patch("/:id", isAuthenticated, contentController.updateContent);
router.delete("/:id", isAuthenticated, contentController.deleteContent);

// Send comment endpoint for comment queue processor
router.post("/:externalId/send-comment", async (req, res) => {
  try {
    console.log(`📥 Received comment request for externalId: ${req.params.externalId}`);
    console.log(`📦 Request body:`, req.body);

    const { externalId } = req.params;
    const { fakeUserId, comment } = req.body;

    // Validate input
    if (!fakeUserId || !comment) {
      console.error(`❌ Missing required fields:`, { fakeUserId, comment });
      return res.status(400).json({
        success: false,
        message: "fakeUserId and comment are required"
      });
    }

    // Get fake user info for logging
    const fakeUser = await storage.getFakeUser(fakeUserId);
    if (!fakeUser) {
      console.error(`❌ Fake user not found: ${fakeUserId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid fake user ID"
      });
    }

    console.log(`✅ Comment sent successfully for ${externalId} by ${fakeUser.name}: ${comment.substring(0, 50)}...`);

    // For now, just return success - you can implement actual external API call here
    return res.json({
      success: true,
      message: "Comment sent successfully",
      data: {
        externalId,
        fakeUser: {
          id: fakeUser.id,
          name: fakeUser.name
        },
        comment: comment.substring(0, 100) + (comment.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ Error in send-comment endpoint:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export the router
export default router;