
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface LyricsEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  songTitle: string;
  artist?: string;
  initialLyrics?: string;
  onSaved?: () => void;
}

export const LyricsEditDialog: React.FC<LyricsEditDialogProps> = ({
  isOpen,
  onClose,
  songId,
  songTitle,
  artist,
  initialLyrics,
  onSaved,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    defaultValues: {
      lyrics: initialLyrics || "",
    },
  });

  const onSubmit = async (data: { lyrics: string }) => {
    if (!data.lyrics.trim()) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.lyricsRequired"),
      });
      return;
    }

    setIsSaving(true);
    try {
      // Check if lyrics already exist for this song
      const { data: existingLyrics } = await supabase
        .from("lyrics")
        .select("id")
        .eq("song_id", songId)
        .maybeSingle();

      let error;
      
      if (existingLyrics) {
        // Update existing lyrics
        const { error: updateError } = await supabase
          .from("lyrics")
          .update({ content: data.lyrics })
          .eq("song_id", songId);
          
        error = updateError;
      } else {
        // Insert new lyrics
        const { error: insertError } = await supabase
          .from("lyrics")
          .insert({ song_id: songId, content: data.lyrics });
          
        error = insertError;
      }

      if (error) {
        throw error;
      }

      toast({
        title: t("common.success"),
        description: t("common.lyricsSaved"),
      });
      
      if (onSaved) {
        onSaved();
      }
      
      onClose();
    } catch (error) {
      console.error("Error saving lyrics:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.errorSavingLyrics"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("common.editLyrics")}
          </DialogTitle>
          <DialogDescription>
            {songTitle} {artist ? `- ${artist}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lyrics"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.lyrics")}</FormLabel>
                  <FormControl>
                    <ScrollArea className="h-[50vh]">
                      <Textarea
                        {...field}
                        className="min-h-[50vh] resize-none font-mono text-sm"
                        placeholder={t("common.enterLyrics")}
                        spellCheck={false}
                      />
                    </ScrollArea>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSaving}
              >
                {t("common.cancel")}
              </Button>
              <Button 
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("common.save")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
