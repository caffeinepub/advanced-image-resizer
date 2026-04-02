import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";
import { Download, FileText, ImageIcon, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type OutputFormat = "jpeg" | "webp" | "png" | "pdf";

interface ImagePreviewData {
  src: string;
  sizeKB: string;
  width: number;
  height: number;
}

interface OutputData {
  type: "image" | "pdf";
  src?: string;
  downloadUrl: string;
  sizeKB: string;
  width: number;
  height: number;
  extension: string;
}

export default function App() {
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [targetSizeKB, setTargetSizeKB] = useState("");
  const [aspectLocked, setAspectLocked] = useState(true);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [pdfQuality, setPdfQuality] = useState(90);
  const [originalData, setOriginalData] = useState<ImagePreviewData | null>(
    null,
  );
  const [outputData, setOutputData] = useState<OutputData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aspectRatioRef = useRef(1);
  const prevOutputUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const revokeOldUrl = useCallback(() => {
    if (prevOutputUrlRef.current) {
      URL.revokeObjectURL(prevOutputUrlRef.current);
      prevOutputUrlRef.current = null;
    }
  }, []);

  const handleFileChange = useCallback(() => {
    const files = fileInputRef.current?.files;
    if (!files || !files.length) return;

    const file = files[0];
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        aspectRatioRef.current = img.width / img.height;
        const sizeKB = (file.size / 1024).toFixed(2);
        setOriginalData({
          src: e.target?.result as string,
          sizeKB,
          width: img.width,
          height: img.height,
        });
        setOutputData(null);
        revokeOldUrl();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [revokeOldUrl]);

  const handleWidthChange = useCallback(
    (val: string) => {
      setWidthInput(val);
      if (aspectLocked && aspectRatioRef.current) {
        const w = Number.parseInt(val);
        if (w) setHeightInput(String(Math.round(w / aspectRatioRef.current)));
      }
    },
    [aspectLocked],
  );

  const handleHeightChange = useCallback(
    (val: string) => {
      setHeightInput(val);
      if (aspectLocked && aspectRatioRef.current) {
        const h = Number.parseInt(val);
        if (h) setWidthInput(String(Math.round(h * aspectRatioRef.current)));
      }
    },
    [aspectLocked],
  );

  const resizeImages = useCallback(() => {
    const files = fileInputRef.current?.files;
    if (!files || !files.length) {
      alert("Please upload at least one image!");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const targetKB = Number.parseInt(targetSizeKB) || null;
    revokeOldUrl();
    setLoading(true);
    setOutputData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const enteredWidth = Number.parseInt(widthInput) || null;
        const enteredHeight = Number.parseInt(heightInput) || null;

        let newWidth = enteredWidth || img.width;
        let newHeight: number;

        if (enteredWidth && enteredHeight) {
          newHeight = aspectLocked
            ? Math.round(newWidth / aspectRatioRef.current)
            : enteredHeight;
        } else {
          newHeight = enteredHeight || img.height;
        }

        const processCanvas = (cw: number, ch: number) => {
          canvas.width = cw;
          canvas.height = ch;
          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);

          if (format === "pdf") {
            const quality = pdfQuality / 100;
            const imageData = canvas.toDataURL("image/jpeg", quality);
            const pdfW = cw * 0.75;
            const pdfH = ch * 0.75;

            const doc = new jsPDF({
              unit: "pt",
              format: [pdfW, pdfH],
              orientation: pdfW > pdfH ? "l" : "p",
            });

            doc.addImage(imageData, "JPEG", 0, 0, pdfW, pdfH);
            const pdfBlob = doc.output("blob");
            const pdfSizeKB = (pdfBlob.size / 1024).toFixed(2);
            const pdfUrl = URL.createObjectURL(pdfBlob);
            prevOutputUrlRef.current = pdfUrl;

            setOutputData({
              type: "pdf",
              downloadUrl: pdfUrl,
              sizeKB: pdfSizeKB,
              width: cw,
              height: ch,
              extension: "pdf",
            });
            setLoading(false);
          } else {
            const mimeType =
              format === "jpeg"
                ? "image/jpeg"
                : format === "webp"
                  ? "image/webp"
                  : "image/png";
            const ext = format === "jpeg" ? "jpg" : format;

            const finalizeBlob = (blob: Blob, w: number, h: number) => {
              const sizeKB = (blob.size / 1024).toFixed(2);
              const url = URL.createObjectURL(blob);
              prevOutputUrlRef.current = url;
              setOutputData({
                type: "image",
                src: url,
                downloadUrl: url,
                sizeKB,
                width: w,
                height: h,
                extension: ext,
              });
              setLoading(false);
            };

            if (format === "jpeg" || format === "webp") {
              const reduceQuality = (q: number) => {
                canvas.toBlob(
                  (blob) => {
                    if (!blob) {
                      setLoading(false);
                      return;
                    }
                    const bSize = blob.size / 1024;
                    if (targetKB && bSize > targetKB && q > 0.1) {
                      reduceQuality(q - 0.05);
                    } else {
                      finalizeBlob(blob, cw, ch);
                    }
                  },
                  mimeType,
                  q,
                );
              };
              reduceQuality(0.9);
            } else {
              // PNG
              canvas.toBlob((blob) => {
                if (!blob) {
                  setLoading(false);
                  return;
                }
                const bSize = blob.size / 1024;
                if (targetKB && bSize > targetKB) {
                  const newW = Math.max(1, Math.floor(cw * 0.9));
                  const newH = Math.max(1, Math.floor(ch * 0.9));
                  if (newW < cw) {
                    processCanvas(newW, newH);
                  } else {
                    finalizeBlob(blob, cw, ch);
                  }
                } else {
                  finalizeBlob(blob, cw, ch);
                }
              }, mimeType);
            }
          }
        };

        processCanvas(newWidth, newHeight);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(files[0]);
  }, [
    widthInput,
    heightInput,
    targetSizeKB,
    aspectLocked,
    format,
    pdfQuality,
    revokeOldUrl,
  ]);

  return (
    <div className="min-h-screen bg-background flex justify-center items-start py-8 px-4">
      {/* Loading overlay */}
      {loading && (
        <div
          data-ocid="resize.loading_state"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div className="flex items-center gap-3 bg-white rounded-lg px-6 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-foreground font-medium">Processing...</span>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-5xl bg-card rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] p-5">
        {/* Mobile: single column. Desktop: 3-column layout */}
        <div className="flex flex-col md:flex-row gap-0 md:divide-x md:divide-border">
          {/* ─── Settings Panel ─── */}
          <div className="flex-1 px-4 py-3 flex flex-col items-center gap-2 border-b md:border-b-0 border-border pb-6 md:pb-3">
            <h2 className="text-xl font-bold text-foreground mb-1 self-start">
              Image Resizer
            </h2>

            {/* File input - semantic label wrapping hidden input */}
            <div className="w-full">
              <span className="text-sm text-muted-foreground mb-1 block">
                Upload Image
              </span>
              <label
                data-ocid="resize.upload_button"
                htmlFor="file-input"
                className="w-full border-2 border-dashed border-border rounded-lg p-3 flex items-center gap-2 hover:border-primary/60 transition-colors cursor-pointer bg-muted/30"
              >
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {fileName || "Click to select image"}
                </span>
                <input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Upload image"
                />
              </label>
            </div>

            {/* Width */}
            <div className="w-full">
              <Label
                htmlFor="width-input"
                className="text-sm text-muted-foreground mb-1 block"
              >
                Width (px)
              </Label>
              <Input
                id="width-input"
                data-ocid="resize.input"
                type="number"
                placeholder="Enter width"
                value={widthInput}
                onChange={(e) => handleWidthChange(e.target.value)}
                aria-label="Width in pixels"
              />
            </div>

            {/* Height */}
            <div className="w-full">
              <Label
                htmlFor="height-input"
                className="text-sm text-muted-foreground mb-1 block"
              >
                Height (px)
              </Label>
              <Input
                id="height-input"
                data-ocid="resize.input"
                type="number"
                placeholder="Enter height"
                value={heightInput}
                onChange={(e) => handleHeightChange(e.target.value)}
                aria-label="Height in pixels"
              />
            </div>

            {/* Target size KB - hidden when PDF */}
            {format !== "pdf" && (
              <div className="w-full">
                <Label
                  htmlFor="target-size-input"
                  className="text-sm text-muted-foreground mb-1 block"
                >
                  Target Size (KB)
                </Label>
                <Input
                  id="target-size-input"
                  data-ocid="resize.input"
                  type="number"
                  placeholder="Target size in KB"
                  value={targetSizeKB}
                  onChange={(e) => setTargetSizeKB(e.target.value)}
                  aria-label="Target size in kilobytes"
                />
              </div>
            )}

            {/* Aspect ratio lock */}
            <div className="w-full flex items-center gap-2 mt-1">
              <Checkbox
                id="aspect-lock"
                data-ocid="resize.checkbox"
                checked={aspectLocked}
                onCheckedChange={(checked) => setAspectLocked(checked === true)}
                aria-label="Lock aspect ratio"
              />
              <Label
                htmlFor="aspect-lock"
                className="text-sm text-foreground cursor-pointer"
              >
                Lock Aspect Ratio
              </Label>
            </div>

            {/* Format selector */}
            <div className="w-full">
              <Label className="text-sm text-muted-foreground mb-1 block">
                Output Format
              </Label>
              <Select
                value={format}
                onValueChange={(val) => setFormat(val as OutputFormat)}
              >
                <SelectTrigger
                  data-ocid="resize.select"
                  className="w-full"
                  aria-label="Output format"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="webp">WEBP</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PDF quality slider - only when PDF */}
            {format === "pdf" && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm text-muted-foreground">
                    PDF Quality
                  </Label>
                  <span className="text-sm font-semibold text-primary">
                    {pdfQuality}
                  </span>
                </div>
                <input
                  data-ocid="resize.input"
                  type="range"
                  min={1}
                  max={100}
                  value={pdfQuality}
                  onChange={(e) =>
                    setPdfQuality(Number.parseInt(e.target.value))
                  }
                  className="w-full"
                  aria-label="PDF quality slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>1</span>
                  <span>100</span>
                </div>
              </div>
            )}

            {/* Resize button */}
            <Button
              data-ocid="resize.primary_button"
              className="w-full mt-2 bg-primary hover:bg-[oklch(0.598_0.158_145)] text-primary-foreground font-semibold"
              onClick={resizeImages}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Resize Image"
              )}
            </Button>
          </div>

          {/* ─── Original Image Panel ─── */}
          <div className="flex-1 px-4 py-3 flex flex-col items-center border-b md:border-b-0 border-border pb-6 md:pb-3">
            <h3 className="text-base font-semibold text-foreground mb-3 self-start">
              Original Image
            </h3>
            {originalData ? (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="w-full rounded-lg overflow-hidden border border-border bg-muted/20 flex items-center justify-center min-h-[160px]">
                  <img
                    src={originalData.src}
                    alt="Original"
                    className="max-w-full max-h-64 object-contain"
                  />
                </div>
                <div className="w-full text-sm text-muted-foreground space-y-0.5">
                  <p>
                    <span className="font-medium text-foreground">Size:</span>{" "}
                    {originalData.sizeKB} KB
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Dimensions:
                    </span>{" "}
                    {originalData.width} × {originalData.height} px
                  </p>
                </div>
              </div>
            ) : (
              <div
                data-ocid="original.empty_state"
                className="w-full flex flex-col items-center justify-center min-h-[160px] rounded-lg border-2 border-dashed border-border text-muted-foreground gap-2"
              >
                <ImageIcon className="h-10 w-10 opacity-30" />
                <p className="text-sm">Upload an image to preview</p>
              </div>
            )}
          </div>

          {/* ─── Resized Output Panel ─── */}
          <div className="flex-1 px-4 py-3 flex flex-col items-center">
            <h3 className="text-base font-semibold text-foreground mb-3 self-start">
              {outputData?.type === "pdf" ? "Resized PDF" : "Resized Image"}
            </h3>
            {outputData ? (
              <div
                data-ocid="resize.success_state"
                className="w-full flex flex-col items-center gap-3"
              >
                {outputData.type === "image" && outputData.src ? (
                  <div className="w-full rounded-lg overflow-hidden border border-border bg-muted/20 flex items-center justify-center min-h-[160px]">
                    <img
                      src={outputData.src}
                      alt="Resized"
                      className="max-w-full max-h-64 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full rounded-lg border border-border bg-muted/20 flex flex-col items-center justify-center min-h-[160px] gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-40" />
                    <p className="text-sm">PDF ready for download</p>
                  </div>
                )}
                <div className="w-full text-sm text-muted-foreground space-y-0.5">
                  <p>
                    <span className="font-medium text-foreground">Size:</span>{" "}
                    {outputData.sizeKB} KB
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Dimensions:
                    </span>{" "}
                    {outputData.width} × {outputData.height} px
                  </p>
                </div>
                <a
                  data-ocid="resize.secondary_button"
                  href={outputData.downloadUrl}
                  download={`resized-image.${outputData.extension}`}
                  className="w-full"
                >
                  <Button className="w-full bg-primary hover:bg-[oklch(0.598_0.158_145)] text-primary-foreground">
                    <Download className="mr-2 h-4 w-4" />
                    Download {outputData.type === "pdf" ? "PDF" : "Image"}
                  </Button>
                </a>
              </div>
            ) : (
              <div
                data-ocid="resize.empty_state"
                className="w-full flex flex-col items-center justify-center min-h-[160px] rounded-lg border-2 border-dashed border-border text-muted-foreground gap-2"
              >
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm">Resized output will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 text-center text-xs text-muted-foreground py-2 bg-background/80 backdrop-blur-sm">
        © {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
