import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { useWhatsAppStore } from '@/store/useWhatsAppStore'

export function QRCodeModal() {
  const { qr, connected } = useWhatsAppStore()

  if (connected || !qr) return null

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no seu celular → Aparelhos conectados → Conectar um aparelho → Escaneie o QR code abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center p-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`}
            alt="QR Code WhatsApp"
            className="rounded-lg border"
            width={256}
            height={256}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Aguardando escaneio...
        </p>
      </DialogContent>
    </Dialog>
  )
}
