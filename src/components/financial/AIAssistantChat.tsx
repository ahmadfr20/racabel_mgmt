"use client";

import { GitCompareArrows, FileText, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui";
import { AssistantChatPanel, type Suggestion } from "@/components/assistant/AssistantChatPanel";

const SUGGESTIONS: Suggestion[] = [
  { icon: FileText, text: "Buat CPAS Plan afiliasi untuk bulan ini." },
  { icon: GitCompareArrows, text: "Bandingkan total pengeluaran bulan ini dengan bulan lalu, lalu simpan hasilnya." },
  { icon: ClipboardList, text: "Tambahkan task PDCA minggu ini." },
  { icon: FileText, text: "Buat SOP prosedur onboarding affiliate dan simpan sebagai Draft." },
];

export function AIAssistantChat({ canUpload, onDataChanged }: { canUpload: boolean; onDataChanged: () => void }) {
  return (
    <Card className="mb-6 !p-0 overflow-hidden">
      <AssistantChatPanel
        canUpload={canUpload}
        suggestions={SUGGESTIONS}
        subtitle="Kelola keuangan, PDCA, task log, kinerja, serta buat CPAS Plan & SOP afiliasi."
        onDataChanged={onDataChanged}
        variant="page"
      />
    </Card>
  );
}
