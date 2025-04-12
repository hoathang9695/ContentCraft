
import express from "express";
import { ContentController } from "../controllers/content.controller";
import { isAuthenticated, isAdmin } from "../middleware/auth";

const router = express.Router();
const contentController = new ContentController();

// Content routes
router.get("/", isAuthenticated, contentController.getAllContents);
router.get("/:id", isAuthenticated, contentController.getContentById);
router.post("/", isAuthenticated, contentController.createContent);
router.patch("/:id", isAuthenticated, contentController.updateContent);
router.delete("/:id", isAuthenticated, contentController.deleteContent);

export default router;
