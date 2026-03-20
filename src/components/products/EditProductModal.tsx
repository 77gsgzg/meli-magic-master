import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { z } from "zod";
import { AITextPickerDialog } from "./AITextPickerDialog";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";

type Product = Tables<'products'>;

const productSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(200, "Título muito longo"),
  description: z.string().trim().max(5000, "Descrição muito longa").optional(),
  price: z.number().positive("Preço deve ser maior que zero"),
  available_quantity: z.number().int().min(0, "Quantidade não pode ser negativa"),
});

interface EditProductModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: TablesUpdate<'products'>) => Promise<Product | null>;
}

export function EditProductModal({
  product,
  open,
  onOpenChange,
  onSave,
}: EditProductModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiPickerOpen, setAiPickerOpen] = useState(false);
  const { isAdmin } = useIsWalletAdmin();

  useEffect(() => {
    if (product) {
      setTitle(product.title || "");
      setDescription(product.description || "");
      setPrice(product.price?.toString() || "");
      setQuantity(product.available_quantity?.toString() || "1");
      setErrors({});
    }
  }, [product]);

  const handleSave = async () => {
    if (!product) return;

    const priceNum = parseFloat(price) || 0;
    const quantityNum = parseInt(quantity) || 0;

    const result = productSchema.safeParse({
      title,
      description: description || undefined,
      price: priceNum,
      available_quantity: quantityNum,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const updated = await onSave(product.id, {
      title: title.trim(),
      description: description.trim() || null,
      price: priceNum,
      available_quantity: quantityNum,
    });
    setSaving(false);

    if (updated) {
      onOpenChange(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Editar Produto</span>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setAiPickerOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Aplicar Texto IA
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Altere as informações do produto. Clique em salvar quando terminar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              variant="glass"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do produto"
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do produto"
              className={`min-h-[150px] bg-secondary/50 ${errors.description ? "border-destructive" : ""}`}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                variant="glass"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                className={errors.price ? "border-destructive" : ""}
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                variant="glass"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className={errors.available_quantity ? "border-destructive" : ""}
              />
              {errors.available_quantity && (
                <p className="text-sm text-destructive">{errors.available_quantity}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AITextPickerDialog
      open={aiPickerOpen}
      onOpenChange={setAiPickerOpen}
      onApply={(aiTitle, aiDescription) => {
        setTitle(aiTitle);
        setDescription(aiDescription);
      }}
    />
    </>
  );
}
