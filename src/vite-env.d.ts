/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'draco3dgltf' {
  interface DracoModule {
    [key: string]: unknown
  }
  interface CreateModuleOptions {
    locateFile?: (path: string, prefix: string) => string
  }
  const draco3d: {
    createDecoderModule: (options?: CreateModuleOptions) => Promise<DracoModule>
    createEncoderModule: (options?: CreateModuleOptions) => Promise<DracoModule>
  }
  export default draco3d
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
