import { mock } from "bun:test"

type MockedModule = {
  specifier: string
  factory: () => unknown
}

type ImportFreshModuleArgs = {
  importPath: string
  mockedModules: MockedModule[]
  restoreSpecifiers: string[]
}

export async function importFreshModuleWithMocks<TModule>(
  args: ImportFreshModuleArgs,
): Promise<TModule> {
  const { importPath, mockedModules, restoreSpecifiers } = args

  for (const mockedModule of mockedModules) {
    mock.module(mockedModule.specifier, mockedModule.factory)
  }

  const importedModule = await (async () => {
    try {
      return await import(importPath) as TModule
    } finally {
      mock.restore()
    }
  })()

  for (const specifier of restoreSpecifiers) {
    const realModule = await import(specifier)
    mock.module(specifier, () => realModule)
  }

  return importedModule
}
