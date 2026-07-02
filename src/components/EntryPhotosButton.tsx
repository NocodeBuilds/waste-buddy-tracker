import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paperclip, Loader2, Trash2, ImageOff } from "lucide-react";
import { useEntryPhotos, useDeletePhoto } from "@/hooks/useEntryPhotos";

interface Props {
  entryId: string;
  count: number;
  canDelete?: boolean;
}

export default function EntryPhotosButton({ entryId, count, canDelete = false }: Props) {
  const [open, setOpen] = useState(false);
  const { data: photos, isLoading } = useEntryPhotos(entryId, open);
  const del = useDeletePhoto();

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 gap-1 text-xs"
        onClick={() => setOpen(true)}
        disabled={count === 0}
        title={count === 0 ? "No photos" : `${count} photo(s)`}
      >
        {count === 0 ? <ImageOff className="h-3.5 w-3.5 opacity-40" /> : <Paperclip className="h-3.5 w-3.5" />}
        {count > 0 && <span>{count}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Photo Evidence</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !photos || photos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No photos attached.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[70vh] overflow-y-auto">
              {photos.map((p) => (
                <div key={p.id} className="relative rounded-md overflow-hidden border bg-muted">
                  <a href={p.signedUrl} target="_blank" rel="noreferrer">
                    <img src={p.signedUrl} alt="" className="w-full h-40 object-cover" />
                  </a>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => del.mutate({ id: p.id, storage_path: p.storage_path })}
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
