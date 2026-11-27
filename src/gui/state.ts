import type { Run } from "../types.js"
import { documentText, type DraftDoc } from "../optimizer.js"

export class RunStore {
  private readonly runs = new Map<string, Run>()
  private readonly maxVersions: number

  constructor(maxVersions = 5) {
    this.maxVersions = Math.max(1, maxVersions)
  }

  get(sessionID: string): Run | undefined {
    return this.runs.get(sessionID)
  }

  start(sessionID: string, original: DraftDoc): Run {
    const run: Run = { original, versions: [], index: -1 }
    this.runs.set(sessionID, run)
    return run
  }

  sync(sessionID: string, current: DraftDoc): Run {
    const run = this.runs.get(sessionID)
    const version = run?.versions[run.index]
    if (!run || !version || documentText(current) !== documentText(version)) {
      return this.start(sessionID, current)
    }
    return run
  }

  push(sessionID: string, original: DraftDoc, text: DraftDoc): Run {
    const run = this.runs.get(sessionID) ?? this.start(sessionID, original)
    run.original = run.versions.length === 0 ? original : run.original

    if (run.versions.length >= this.maxVersions) {
      run.versions.shift()
      if (run.index >= 0) run.index -= 1
    }

    run.versions.push(text)
    run.index = run.versions.length - 1
    return run
  }

  setIndex(sessionID: string, index: number): Run | undefined {
    const run = this.runs.get(sessionID)
    if (!run || index < 0 || index >= run.versions.length) return undefined
    run.index = index
    return run
  }

  clear(sessionID: string): void {
    this.runs.delete(sessionID)
  }

  clearAll(): void {
    this.runs.clear()
  }
}
