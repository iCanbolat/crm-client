import { describe, expect, it, vi } from "vitest"

import { downloadText, toCsv } from "../csv"

describe("csv", () => {
  it("escapes delimiters, quotes and formula prefixes", () => {
    expect(
      toCsv([
        ["a", "b,c"],
        ['"x"', "=1+1"],
      ])
    ).toBe('a,"b,c"\r\n"""x""",\'=1+1')
  })

  it("downloads text with a UTF-8 BOM", async () => {
    const createObjectURL = vi.fn(() => "blob:file")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    downloadText("rapor.csv", "a,b")

    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:file")
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe("text/csv;charset=utf-8")
    // `text()` drops the BOM while decoding: check the raw bytes.
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(await blob.text()).toBe("a,b")
  })
})
