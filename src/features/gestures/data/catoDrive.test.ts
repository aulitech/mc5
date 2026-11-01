import { describe, expect, it } from "vitest";
import { writeModelFolder } from "./catoDrive";

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
