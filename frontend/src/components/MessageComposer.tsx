import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Info, Loader2, Mail, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, type GeneratedMessage, type MessageKind, type OfferWithMatch, type CompanyResult } from "@/lib/api";
import { mailtoHref } from "@/lib/format";

const TIPO_OPTIONS: { value: MessageKind; label: string }[] = [
  { value: "cv_email", label: "Enviar el CV por correo" },
  { value: "espontanea", label: "Candidatura espontánea (sin oferta publicada)" },
  { value: "practicas", label: "Solicitar prácticas (FCT / Dual)" },
  { value: "recien_titulado", label: "Presentarse como recién titulado" },
  { value: "responder_oferta", label: "Responder a una oferta concreta" },
];

export default function MessageComposer({
  open,
  onOpenChange,
  context,
  clientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: { result: CompanyResult; offer: OfferWithMatch | null } | null;
  clientId: string;
}) {
  const [tipo, setTipo] = useState<MessageKind>("espontanea");
  const [notas, setNotas] = useState("");
  const [message, setMessage] = useState<GeneratedMessage | null>(null);
  const generatedKeyRef = useRef<string>("");

  const generate = useMutation({
    mutationFn: (kind: MessageKind) =>
      apiPost<GeneratedMessage>(
        `/messages/generate?client_id=${encodeURIComponent(clientId)}`,
        {
          tipo: kind,
          company_id: context?.result.company.id ?? "",
          offer_id: context?.offer?.id ?? null,
          notas: notas.trim() ? notas.trim() : null,
        }
      ),
    onSuccess: (msg) => {
      setMessage(msg);
      if (msg.generado_por === "plantilla") {
        toast.info("La IA no está disponible ahora mismo; se ha usado la plantilla local.");
      }
    },
    onError: () => toast.error("No se pudo generar el mensaje. Inténtalo de nuevo."),
  });

  // Genera automáticamente al abrir (una vez por empresa/oferta; editable después).
  useEffect(() => {
    if (!open || !context) return;
    setTipo(context.offer ? "responder_oferta" : "espontanea");
    const key = `${context.result.company.id}:${context.offer?.id ?? "none"}`;
    setMessage(null);
    if (generatedKeyRef.current !== key) {
      generatedKeyRef.current = key;
      generate.mutate(context.offer ? "responder_oferta" : "espontanea");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context]);

  const company = context?.result.company;

  const copyMessage = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(`${message.asunto}\n\n${message.cuerpo}`);
      toast.success("Mensaje copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar; selecciona el texto manualmente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="message-composer-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Sparkles className="size-5 text-blue-600" aria-hidden />
            Generador de mensajes — {company?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            El mensaje usa los datos de tu perfil FP y de la empresa. Edítalo libremente antes de enviarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-600">Tipo de mensaje</Label>
            <Select
              value={tipo}
              onValueChange={(v: string) => setTipo(v as MessageKind)}
            >
              <SelectTrigger size="sm" data-testid="message-type-select" className="mt-1 w-full">
                <SelectValue>{TIPO_OPTIONS.find((o) => o.value === tipo)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="message-notes" className="text-xs text-slate-600">
              Notas para personalizar (opcional)
            </Label>
            <Input
              id="message-notes"
              data-testid="message-notes-input"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej.: mencionar mi prácticas en un taller, disponibilidad de mudanza…"
              maxLength={500}
              className="mt-1"
            />
          </div>

          {generate.isPending && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500" data-testid="message-loading">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Redactando el mensaje con tu perfil…
            </div>
          )}

          {message && (
            <div className="space-y-2" data-testid="message-result">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant={message.generado_por === "ia" ? "default" : "secondary"}
                  data-testid="message-generado-badge"
                  className={message.generado_por === "ia" ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" : ""}
                >
                  {message.generado_por === "ia" ? "Generado con IA (Claude)" : "Plantilla local (IA no disponible)"}
                </Badge>
                <Button
                  size="xs"
                  variant="outline"
                  data-testid="message-regenerate-button"
                  onClick={() => generate.mutate(tipo)}
                  disabled={generate.isPending}
                >
                  <Wand2 className="size-3.5" aria-hidden />
                  Generar de nuevo
                </Button>
              </div>
              <div>
                <Label htmlFor="message-subject" className="text-xs text-slate-600">
                  Asunto
                </Label>
                <Input
                  id="message-subject"
                  data-testid="message-subject-input"
                  value={message.asunto}
                  onChange={(e) => setMessage({ ...message, asunto: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="message-body" className="text-xs text-slate-600">
                  Mensaje (editable)
                </Label>
                <Textarea
                  id="message-body"
                  data-testid="message-body-textarea"
                  value={message.cuerpo}
                  onChange={(e) => setMessage({ ...message, cuerpo: e.target.value })}
                  rows={10}
                  className="mt-1 font-sans text-sm leading-relaxed"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" data-testid="message-copy-button" onClick={copyMessage} disabled={!message}>
              <Copy className="size-4" aria-hidden />
              Copiar mensaje
            </Button>
            {company?.email ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="message-mailto-button"
                onClick={() => {
                  if (!message || !company.email) return;
                  window.location.href = mailtoHref(company.email, message.asunto, message.cuerpo);
                }}
                disabled={!message}
              >
                <Mail className="size-4" aria-hidden />
                Abrir en tu cliente de correo
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled data-testid="message-mailto-unavailable">
                <Mail className="size-4" aria-hidden />
                Email no disponible en la fuente
              </Button>
            )}
            {company && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
                <Info className="size-3" aria-hidden />
                Revisa siempre el mensaje antes de enviarlo
                <ExternalLink className="size-3" aria-hidden />
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
