import { describe, expect, it } from "vitest";
import { readModelFolder, writeModelFolder } from "./catoDrive";

// Just enough of FileSystemDirectoryHandle for writeModelFolder.
function fakeFolder(files: Map<string, string>) {
  return {
    getFileHandle: async (name: string) => ({
      createWritable: async () => ({
        write: async (contents: string) => void files.set(name, contents),
        close: async () => {},
      }),
    }),
    keys: async function* () {
      yield* [...files.keys()];
    },
    removeEntry: async (name: string) => void files.delete(name),
  };
}

describe("writeModelFolder", () => {
  it("writes the model into xcorr_model, removing templates the new model doesn't have", async () => {
    const files = new Map([
      ["model_params.csv", "old"],
      ["model_templates_0.csv", "old"],
      ["model_templates_1.csv", "old"],
      ["notes.txt", "keep"],
    ]);
    const folders: string[] = [];
    const drive = {
      getDirectoryHandle: async (name: string, options: { create: boolean }) => {
        folders.push(`${name}${options.create ? " (create)" : ""}`);
        return fakeFolder(files);
      },
    } as unknown as FileSystemDirectoryHandle;

    await writeModelFolder(drive, [
      ["model_params.csv", "new"],
      ["model_templates_0.csv", "t0"],
    ]);
    expect(folders).toEqual(["xcorr_model (create)"]);
    expect(Object.fromEntries(files)).toEqual({
      "model_params.csv": "new",
      "model_templates_0.csv": "t0",
      "notes.txt": "keep",
    });
  });
});

describe("readModelFolder", () => {
  const notFound = () => new DOMException("not found", "NotFoundError");
  // A drive whose xcorr_model folder holds `files` (name → [contents, lastModified]).
  const drive = (files: Record<string, [string, number]> | null) =>
    ({
      name: "AULI_CATO",
      getDirectoryHandle: async () => {
        if (!files) throw notFound();
        return {
          getFileHandle: async (name: string) => {
            if (!(name in files)) throw notFound();
            const [text, lastModified] = files[name];
            return { getFile: async () => ({ text: async () => text, lastModified }) };
          },
        };
      },
    }) as unknown as FileSystemDirectoryHandle;
  const values = (n: number) => Array.from({ length: 600 }, () => n).join(" ");

  it("reads one take per class, timed by its template file", async () => {
    const takes = await readModelFolder(
      drive({
        "model_params.csv": ["2 100 6 10.0\ncw\nnod_up", 0],
        "model_templates_0.csv": [values(1), Date.UTC(2026, 10, 1, 12)],
        "model_templates_1.csv": [values(2), Date.UTC(2026, 10, 1, 13)],
      }),
    );
    expect(takes.map(({ gestureName, timestamp, data }) => [gestureName, timestamp, data.length])).toEqual([
      ["cw", "2026-11-01T12:00:00.000Z", 100],
      ["nod up", "2026-11-01T13:00:00.000Z", 100],
    ]);
  });

  it("says when the drive has no model, or a template is missing", async () => {
    await expect(readModelFolder(drive(null))).rejects.toThrow("There's no model on AULI_CATO");
    await expect(readModelFolder(drive({ "model_params.csv": ["1 100 6 10.0\ncw", 0] }))).rejects.toThrow(
      "The model on AULI_CATO is missing model_templates_0.csv.",
    );
  });
});
