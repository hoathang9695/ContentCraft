
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ReactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalId: string;
  fakeUser: any;
}

const REACTION_TYPES = ['like', 'heart', 'haha', 'wow', 'sad', 'angry'];

export function ReactionDialog({ open, onOpenChange, externalId, fakeUser }: ReactionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReaction = async () => {
    setIsSubmitting(true);
    
    try {
      // Get random reaction type
      const randomReactionType = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];
      console.log(`Reaction type:`, randomReactionType);

      // Log request details
      const requestBody = {
        custom_vote_type: randomReactionType,
        page_id: null
      };

      // Validate required data before proceeding
      if (!externalId) {
        throw new Error('External ID is required');
      }
      if (!fakeUser) {
        throw new Error('Fake user data is required');
      }
      
      console.log('=== REACTION REQUEST DETAILS ===');
      console.log('External ID:', externalId);
      console.log('Fake User:', fakeUser);
      console.log('Random Reaction Type:', randomReactionType);
      console.log('URL:', `https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`);
      console.log('Headers:', {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${fakeUser.token}`,
        'Cache-Control': 'no-cache'
      });
      console.log('Request Body:', requestBody);

      if (!fakeUser || !fakeUser.token) {
        throw new Error('No fake user token available');
      }

      const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`, {
        mode: 'cors',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fakeUser.token}`,
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('=== REACTION RESPONSE DETAILS ===');
      console.log('Response Status:', response.status);
      console.log('Response Status Text:', response.statusText);
      
      const responseText = await response.text();
      console.log('Response body:', responseText);
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${responseText}`);
      }
      
      try {
        const responseData = JSON.parse(responseText);
        console.log('Parsed response:', responseData);
      } catch (e) {
        console.log('Response is not JSON:', responseText);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error sending reaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Reaction</DialogTitle>
          <DialogDescription>
            Send a random reaction using the fake user account
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleReaction}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Reaction'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
