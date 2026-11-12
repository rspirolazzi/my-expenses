import { fileNameFromDisposition, saveBlob } from "@/lib/download";

it("prefers the UTF-8 file name", () => {
  const header =
    "attachment; filename=\"mis-gastos_ano_2026-11-12.zip\"; filename*=UTF-8''mis-gastos_a%C3%B1o_2026-11-12.zip";
  expect(fileNameFromDisposition(header, "export.zip")).toBe("mis-gastos_año_2026-11-12.zip");
});

it("falls back to the plain name and then to the default", () => {
  expect(fileNameFromDisposition('attachment; filename="a.json"', "x")).toBe("a.json");
  expect(fileNameFromDisposition("attachment; filename=b.zip", "x")).toBe("b.zip");
  expect(fileNameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A", "x")).toBe("x");
  expect(fileNameFromDisposition(null, "export.zip")).toBe("export.zip");
});

it("saves through a temporary link and frees the URL", () => {
  const createObjectURL = jest.fn(() => "blob:1");
  const revokeObjectURL = jest.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  saveBlob(new Blob(["x"]), "a.zip");
  expect(click).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  expect(document.querySelector("a[download]")).toBeNull();
});
