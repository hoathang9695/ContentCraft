
import { Request, Response } from "express";
import { storage } from "../storage";
import { insertInfringingContentSchema } from "@shared/schema";
import { ZodError } from "zod";
import Redis from "ioredis";

export class InfringingContentController {
  // Get paginated infringing contents with date filters
  async getPaginatedInfringingContents(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as Express.User;
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
      const searchQuery = req.query.search as string;

      console.log("Paginated infringing contents request:", {
        user: { id: user.id, role: user.role },
        page,
        limit,
        startDate,
        endDate,
        searchQuery
      });

      // Get paginated data from storage
      const result = await storage.getPaginatedInfringingContents({
        userId: user.id,
        userRole: user.role,
        page,
        limit,
        startDate,
        endDate,
        searchQuery
      });

      console.log(`Returning paginated infringing contents: ${result.data.length} items of ${result.total} total`);

      return res.json(result);
    } catch (error) {
      console.error("Error fetching paginated infringing contents:", error);
      return res.status(500).json({
        message: "Error fetching paginated infringing contents",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get infringing content by ID
  async getInfringingContentById(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const content = await storage.getInfringingContent(contentId);
      const user = req.user as Express.User;

      if (!content) {
        return res.status(404).json({ message: "Infringing content not found" });
      }

      if (user.role !== "admin" && content.assigned_to_id !== user.id) {
        return res
          .status(403)
          .json({ message: "You can only view infringing content assigned to you" });
      }

      console.log("Infringing content fetched:", content);
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Error fetching infringing content" });
    }
  }

  // Create new infringing content
  async createInfringingContent(req: Request, res: Response) {
    try {
      const user = req.user as Express.User;
      let assigned_to_id = user.id;

      if (user.role === "admin" && req.body.assigned_to_id) {
        assigned_to_id = req.body.assigned_to_id;
      }

      console.log("Creating new infringing content with data:", {
        userId: user.id,
        username: user.username,
        role: user.role,
        requestBody: req.body,
      });

      const inputData = {
        ...req.body,
        assigned_to_id: Number(assigned_to_id),
      };

      if (isNaN(inputData.assigned_to_id)) {
        return res.status(400).json({
          message: "Invalid assigned_to_id value",
          value: req.body.assigned_to_id,
        });
      }

      const validatedData = insertInfringingContentSchema.parse(inputData);
      const newContent = await storage.createInfringingContent(validatedData);
      return res.status(201).json(newContent);
    } catch (error) {
      console.error("Error creating infringing content:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      return res.status(500).json({
        message: "Error creating infringing content",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update infringing content
  async updateInfringingContent(req: Request, res: Response) {
    try {
      console.log("Update infringing content request:", {
        body: req.body,
        params: req.params,
        user: req.user
          ? {
              id: (req.user as Express.User).id,
              role: (req.user as Express.User).role,
            }
          : null,
      });

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized - Please log in",
        });
      }

      const contentId = Number(req.params.id);
      if (!contentId || isNaN(contentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid infringing content ID",
        });
      }

      const existingContent = await storage.getInfringingContent(contentId);
      const user = req.user as Express.User;

      console.log("Existing infringing content:", existingContent);

      if (!existingContent) {
        return res.status(404).json({ message: "Infringing content not found" });
      }

      if (existingContent.assigned_to_id !== user.id && user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "You can only edit infringing content assigned to you" });
      }

      // Parse và validate input data
      const inputData = {
        ...req.body,
        updated_at: new Date(),
      };

      // Thêm thời gian xử lý khi hoàn thành
      if (inputData.status === "completed" && !inputData.processing_time) {
        inputData.processing_time = new Date();
      }

      console.log("Processed input data:", inputData);

      // Validate data
      const validatedData = insertInfringingContentSchema.partial().parse(inputData);

      console.log("Validated infringing content data:", validatedData);

      const updatedContent = await storage.updateInfringingContent(
        contentId,
        validatedData,
      );

      if (!updatedContent) {
        console.error("No infringing content returned after update");
        return res.status(500).json({
          success: false,
          message: "Failed to update infringing content",
        });
      }

      console.log("Infringing content updated successfully:", updatedContent);

      return res.json({
        success: true,
        data: updatedContent,
      });
    } catch (error) {
      console.error("Error in update infringing content controller:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error updating infringing content",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Search and process infringing content
  async searchAndProcessInfringingContent(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as Express.User;
      const { externalId, violationDescription } = req.body;

      if (!externalId || !violationDescription) {
        return res.status(400).json({ 
          message: "External ID và mô tả vi phạm là bắt buộc" 
        });
      }

      console.log("Processing infringing content:", {
        externalId,
        violationDescription,
        user: { id: user.id, name: user.name }
      });

      // Create infringing content record with pending status
      const newContent = await storage.createInfringingContent({
        externalId: externalId,
        assigned_to_id: user.id,
        processing_time: null, // Will be set when completed
        violation_description: violationDescription,
        status: "pending"
      });

      // Try to connect to Redis and delete the key
      let redisDeleteSuccess = false;
      let redisError = null;

      try {
        // Check for Redis connection URL in environment
        const redisUrl = process.env.REDIS_URL || process.env.REDIS_SEARCH_URL;
        
        if (!redisUrl) {
          console.warn("Redis URL not found in environment variables");
          redisError = "Redis URL not configured";
        } else {
          const redis = new Redis(redisUrl);
          
          // Search for the key pattern
          const searchPattern = `*${externalId}*`;
          const keys = await redis.keys(searchPattern);
          
          console.log(`Found ${keys.length} keys matching pattern: ${searchPattern}`);
          
          if (keys.length > 0) {
            // Delete all matching keys
            const deleteResult = await redis.del(...keys);
            console.log(`Deleted ${deleteResult} keys from Redis`);
            redisDeleteSuccess = deleteResult > 0;
          } else {
            console.log(`No keys found matching External ID: ${externalId}`);
            redisDeleteSuccess = true; // Consider as success if no keys found
          }
          
          await redis.disconnect();
        }
      } catch (error) {
        console.error("Redis operation failed:", error);
        redisError = error instanceof Error ? error.message : String(error);
      }

      // Update status based on Redis operation result
      const finalStatus = redisDeleteSuccess ? "completed" : "processing";
      const processingTime = redisDeleteSuccess ? new Date() : null;

      const updatedContent = await storage.updateInfringingContent(newContent.id, {
        status: finalStatus,
        processing_time: processingTime
      });

      return res.json({
        success: true,
        data: updatedContent,
        redis: {
          success: redisDeleteSuccess,
          error: redisError
        },
        message: redisDeleteSuccess 
          ? "Đã xử lý thành công và xóa nội dung vi phạm từ Redis"
          : "Đã tạo yêu cầu xử lý, nhưng không thể kết nối Redis"
      });

    } catch (error) {
      console.error("Error in searchAndProcessInfringingContent:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error processing infringing content",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Delete infringing content
  async deleteInfringingContent(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getInfringingContent(contentId);
      const user = req.user as Express.User;

      if (!existingContent) {
        return res.status(404).json({ message: "Infringing content not found" });
      }

      if (user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only administrators can delete infringing content" });
      }

      const deleted = await storage.deleteInfringingContent(contentId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting infringing content" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting infringing content" });
    }
  }
}
