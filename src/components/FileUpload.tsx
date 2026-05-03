import { useCallback, useState } from "react";

interface FileUploadProps {
  label: string;
  onFileSelected: (bytes: Uint8Array) => void;
  disabled?: boolean;
}

export function FileUpload({ label, onFileSelected, disabled }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      onFileSelected(new Uint8Array(buffer));
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragOver ? "#2563eb" : "#cbd5e1"}`,
        borderRadius: 8,
        padding: "2rem",
        textAlign: "center",
        background: dragOver ? "#eff6ff" : "#f8fafc",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <label style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: "0.5rem 0", color: "#64748b", fontSize: "0.875rem" }}>
          {fileName
            ? `Fichier : ${fileName}`
            : "Glissez un PDF ici ou cliquez pour parcourir"}
        </p>
        <input
          type="file"
          accept=".pdf"
          onChange={handleChange}
          disabled={disabled}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}
