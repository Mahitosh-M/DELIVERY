import {
  useEffect,
  useId,
  isValidElement,
  cloneElement,
  type ReactElement,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, Upload, Check, PenLine, Image } from "lucide-react";
import { localEvidence } from "./data";
import { useApp } from "./context";
export function Badge({ children }: { children: ReactNode }) {
  const value = String(children);
  return (
    <span
      className={
        "badge " +
        (/Delivered|Approved|Closed|Settled|Ready|Saved/.test(value)
          ? "good"
          : /Failed|Rejected|Cancelled/.test(value)
            ? "bad"
            : /Pending|Partial|Submitted|Clarification/.test(value)
              ? "warn"
              : "neutral")
      }
    >
      {children}
    </span>
  );
}
export function Empty({
  children = "No records match your filters.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">&rarr;</div>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = previous;
    };
  }, [onClose]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={["modal", wide ? "wide" : "", className].filter(Boolean).join(" ")}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const items = box.current?.querySelectorAll<HTMLElement>(
              'button,input,select,textarea,a[href],[tabindex="0"]',
            );
            if (!items?.length) return;
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const child = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ id?: string; "aria-label"?: string }>,
        {
          id,
          "aria-label":
            (children.props as { "aria-label"?: string })["aria-label"] ??
            label,
        },
      )
    : children;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {child}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Form({
  onSubmit,
  children,
  label = "Save",
}: {
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
  label?: string;
}) {
  const { busy, notify } = useApp();
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {children}
      <footer>
        <button className="primary" type="submit" disabled={saving || busy}>
          {saving ? "Saving..." : label}
        </button>
      </footer>
    </form>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onClose} className="confirmation-dialog">
      <Form
        label="Confirm"
        onSubmit={async () => {
          await onConfirm();
          onClose();
        }}
      >
        <p className="mb-4 muted">{description}</p>
        {children}
      </Form>
    </Modal>
  );
}
export function EvidenceInput({
  label,
  value,
  onChange,
  signature = false,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  signature?: boolean;
}) {
  const { user, notify } = useApp();
  const [preview, setPreview] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (value)
      localEvidence.get(value).then((e) => setPreview(e?.dataUrl ?? null));
    else setPreview(null);
  }, [value]);
  async function upload(file: File) {
    try {
      if (file.size > 15_000_000)
        throw new Error("Select an image below 15 MB");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image read failed"));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new window.Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("Unable to decode image"));
        im.src = data;
      });
      const scaled = document.createElement("canvas");
      const ratio = Math.min(1, 1400 / Math.max(image.width, image.height));
      scaled.width = image.width * ratio;
      scaled.height = image.height * ratio;
      scaled
        .getContext("2d")!
        .drawImage(image, 0, 0, scaled.width, scaled.height);
      const id = await localEvidence.save(
        user.id,
        file.name,
        scaled.toDataURL("image/jpeg", 0.8),
      );
      onChange(id);
    } catch (e) {
      notify(String(e), true);
    }
  }
  return (
    <div className="evidence">
      <span className="field-label">{label}</span>
      {preview ? (
        <div className="evidence-preview">
          <img src={preview} alt={label} />
          <button type="button" onClick={() => onChange(null)}>
            Replace evidence
          </button>
          <span className="saved">
            <Check size={13} /> Saved locally
          </span>
        </div>
      ) : (
        <div className="evidence-actions">
          <label className="upload">
            <Upload size={18} />
            <span>Attach photo</span>
            <input
              aria-label={label}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </label>
          {signature && (
            <button
              type="button"
              className="secondary"
              onClick={() => setSigning(!signing)}
            >
              <PenLine size={16} /> Capture signature
            </button>
          )}
        </div>
      )}
      {signing && !preview && (
        <div>
          <canvas
            ref={canvas}
            width={600}
            height={200}
            className="signature"
            aria-label="Signature canvas"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = e.currentTarget.getBoundingClientRect();
              const ctx = e.currentTarget.getContext("2d")!;
              ctx.strokeStyle = "#152f2c";
              ctx.lineWidth = 3;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(
                ((e.clientX - r.left) * 600) / r.width,
                ((e.clientY - r.top) * 200) / r.height,
              );
              setDrawing(true);
              setDirty(true);
            }}
            onPointerMove={(e) => {
              if (!drawing) return;
              const r = e.currentTarget.getBoundingClientRect();
              const ctx = e.currentTarget.getContext("2d")!;
              ctx.lineTo(
                ((e.clientX - r.left) * 600) / r.width,
                ((e.clientY - r.top) * 200) / r.height,
              );
              ctx.stroke();
            }}
            onPointerUp={() => setDrawing(false)}
            onPointerCancel={() => setDrawing(false)}
          />
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                canvas.current?.getContext("2d")?.clearRect(0, 0, 600, 200);
                setDirty(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!dirty}
              onClick={async () => {
                try {
                  const id = await localEvidence.save(
                    user.id,
                    "Customer signature",
                    canvas.current!.toDataURL(),
                  );
                  onChange(id);
                  setSigning(false);
                } catch (e) {
                  notify(String(e), true);
                }
              }}
            >
              Save signature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function EvidenceLink({
  id,
  expired = false,
  label = "View evidence",
}: {
  id: string | null;
  expired?: boolean;
  label?: string;
}) {
  const [data, setData] = useState<string | null>(null);
  if(expired)return <span className="muted text-xs">Evidence removed after seven-day retention</span>;
  if (!id)
    return <span className="muted text-xs">No evidence recorded</span>;
  return (
    <>
      <button
        className="link"
        onClick={async () => {
          const e = await localEvidence.get(id);
          setData(e?.dataUrl ?? null);
        }}
      >
        <Image size={14} />
        {label}
      </button>
      {data && (
        <Modal title={label} onClose={() => setData(null)}>
          <img className="proof-image" src={data} alt={label} />
        </Modal>
      )}
    </>
  );
}
export function Search({
  value,
  onChange,
  placeholder = "Search records...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="search"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
