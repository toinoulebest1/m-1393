
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export const OneDriveSettings = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          OneDrive Storage (Deprecated)
        </CardTitle>
        <CardDescription>
          OneDrive storage has been removed from this application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
            Service Discontinued
          </Badge>
          <p className="text-sm text-muted-foreground">
            OneDrive integration has been completely removed. The application now uses Dropbox (if configured) or Supabase storage as fallback.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
