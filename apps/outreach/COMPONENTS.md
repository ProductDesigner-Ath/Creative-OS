# Component provenance

The committed `src/components/ui/*.jsx` files are the actual MIT-licensed shadcn/ui New York v4 registry components, taken from the official `shadcn-ui/ui` repository at commit `e62c9435fff729a175f38983dee73b2cb4f6a069`.

The registry CLI endpoint was inaccessible in this environment. The official repository was used instead. Changes from upstream: TypeScript annotations removed using esbuild with JSX preserved; `cn` import mapped to `@/lib/utils`; registry imports mapped to `@/components/ui`. Component behaviour is retained. MIT attribution is in SHADCN-LICENSE.md.

Used by the layout: Button, Badge, Card, Input, Textarea, Label, Dialog, Sheet, Table, Tabs, Native Select, Checkbox, Progress. React and Radix provide component behaviour. No Vercel deployment is needed.

Read ../../DESIGN.md before restyling. Do not replace these primitives with superficially similar custom controls.
