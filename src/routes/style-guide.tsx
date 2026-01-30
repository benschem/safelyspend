import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Palette, Plus, Pencil, Trash2, Download, Settings, ArrowRight, Landmark, PiggyBank, CreditCard } from 'lucide-react';

export function StyleGuidePage() {
  return (
    <div className="page-shell">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-violet-500/10">
            <Palette className="h-5 w-5 text-violet-500" />
          </div>
          Style Guide
        </h1>
        <p className="page-description">Design system reference for the application.</p>
      </div>

      <div className="space-y-12">
        {/* Typography Section */}
        <section className="section">
          <div className="section-header">
            <h2>Typography</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Global heading styles work without classes.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body space-y-6">
                <div>
                  <h1>Heading 1 - Page Titles</h1>
                  <p className="mt-1 text-sm text-muted-foreground">text-2xl font-semibold tracking-tight</p>
                </div>
                <Separator />
                <div>
                  <h2>Heading 2 - Section Titles</h2>
                  <p className="mt-1 text-sm text-muted-foreground">text-lg font-semibold tracking-tight</p>
                </div>
                <Separator />
                <div>
                  <h3>Heading 3 - Panel Titles</h3>
                  <p className="mt-1 text-sm text-muted-foreground">text-base font-medium</p>
                </div>
                <Separator />
                <div>
                  <h4>Heading 4 - Labels</h4>
                  <p className="mt-1 text-sm text-muted-foreground">text-sm font-medium</p>
                </div>
                <Separator />
                <div>
                  <p className="page-title">Page Title Class</p>
                  <p className="mt-1 text-sm text-muted-foreground">text-3xl font-bold - for hero headings</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Colors Section */}
        <section className="section">
          <div className="section-header">
            <h2>Colors</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Warm, calming palette with semantic tokens.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg bg-background border" />
                    <p className="text-sm font-medium">Background</p>
                    <p className="text-xs text-muted-foreground">Warm off-white</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg bg-surface-raised border" />
                    <p className="text-sm font-medium">Surface Raised</p>
                    <p className="text-xs text-muted-foreground">Panel background</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg bg-muted" />
                    <p className="text-sm font-medium">Muted</p>
                    <p className="text-xs text-muted-foreground">Subtle backgrounds</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg bg-primary" />
                    <p className="text-sm font-medium">Primary</p>
                    <p className="text-xs text-muted-foreground">Actions</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg bg-destructive" />
                    <p className="text-sm font-medium">Destructive</p>
                    <p className="text-xs text-muted-foreground">Danger actions</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg border-2 border-border" />
                    <p className="text-sm font-medium">Border</p>
                    <p className="text-xs text-muted-foreground">Soft contrast</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Panel Section */}
        <section className="section">
          <div className="section-header">
            <h2>Panels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Raised surfaces with subtle shadow.
            </p>
          </div>
          <div className="section-content space-y-4">
            {/* Basic Panel */}
            <div className="panel">
              <div className="panel-body">
                <h3>Basic Panel</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  A simple panel with content. Uses --surface-raised, --border-subtle, and --shadow-color.
                </p>
              </div>
            </div>

            {/* Panel with Header */}
            <div className="panel">
              <div className="panel-header">
                <h3>Panel with Header</h3>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="panel-body">
                <p className="text-sm text-muted-foreground">
                  Panel headers separate title/actions from content.
                </p>
              </div>
            </div>

            {/* Panel with Items */}
            <div className="panel">
              <div className="panel-header">
                <h3>Panel with Items</h3>
              </div>
              <div className="divide-y">
                {['First item', 'Second item', 'Third item'].map((item) => (
                  <div key={item} className="flex items-center justify-between p-4">
                    <span>{item}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Cards Section */}
        <section className="section">
          <div className="section-header">
            <h2>Cards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Interactive cards with consistent hover states.
            </p>
          </div>
          <div className="section-content space-y-6">
            {/* Clickable card - navigates */}
            <div>
              <h4 className="mb-3">Navigation Card (links to another page)</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                Shows arrow on hover. Use for cards that navigate to another page.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Link
                  to="/style-guide"
                  className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10">
                      <Landmark className="h-5 w-5 text-sky-500" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Cash</p>
                  <p className="mt-1 text-xl font-semibold">$1,234.56</p>
                </Link>
                <Link
                  to="/style-guide"
                  className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <PiggyBank className="h-5 w-5 text-blue-500" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Savings</p>
                  <p className="mt-1 text-xl font-semibold">$5,678.90</p>
                </Link>
              </div>
            </div>

            <Separator />

            {/* Clickable card - opens dialog */}
            <div>
              <h4 className="mb-3">Action Card (opens dialog/modal)</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                No arrow. Use for cards that open a dialog or perform an action without navigating.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => alert('Opens edit dialog')}
                  className="w-full cursor-pointer text-left rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <PiggyBank className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Emergency Fund</p>
                  <p className="mt-1 text-xl font-semibold">$10,000</p>
                  <p className="mt-2 text-sm text-muted-foreground">Click to edit</p>
                </button>
                <button
                  type="button"
                  onClick={() => alert('Opens edit dialog')}
                  className="w-full cursor-pointer text-left rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
                    <PiggyBank className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Holiday Fund</p>
                  <p className="mt-1 text-xl font-semibold">$2,500</p>
                  <p className="mt-2 text-sm text-muted-foreground">Click to edit</p>
                </button>
              </div>
            </div>

            <Separator />

            {/* Static/disabled card */}
            <div>
              <h4 className="mb-3">Static Card (disabled/coming soon)</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                No hover effect. Use for disabled or placeholder cards.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-5 opacity-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                    <CreditCard className="h-5 w-5 text-red-500" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Debt</p>
                  <p className="mt-1 text-xl font-semibold text-muted-foreground">$0</p>
                  <p className="mt-2 text-sm text-muted-foreground">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Empty State Section */}
        <section className="section">
          <div className="section-header">
            <h2>Empty State</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Placeholder for when there is no content.
            </p>
          </div>
          <div className="section-content">
            <div className="empty-state">
              <p className="empty-state-text">No items yet.</p>
              <Button className="empty-state-action">
                <Plus className="h-4 w-4" />
                Add your first item
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* Toolbar Section */}
        <section className="section">
          <div className="section-header">
            <h2>Toolbar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Horizontal bar for actions.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body">
                <div className="toolbar">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Add New
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button variant="ghost">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Buttons Section */}
        <section className="section">
          <div className="section-header">
            <h2>Buttons</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All button variants and sizes.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body space-y-6">
                <div>
                  <h4 className="mb-3">Variants</h4>
                  <div className="toolbar">
                    <Button>Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-3">Sizes</h4>
                  <div className="toolbar items-end">
                    <Button size="sm">Small</Button>
                    <Button>Default</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-3">With Icons</h4>
                  <div className="toolbar">
                    <Button>
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Badges Section */}
        <section className="section">
          <div className="section-header">
            <h2>Badges</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Status indicators and labels.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body">
                <div className="toolbar">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Alerts Section */}
        <section className="section">
          <div className="section-header">
            <h2>Alerts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contextual feedback messages.
            </p>
          </div>
          <div className="section-content space-y-3">
            <Alert variant="info">This is an informational message.</Alert>
            <Alert variant="success">Operation completed successfully.</Alert>
            <Alert variant="warning">Please review before proceeding.</Alert>
            <Alert variant="destructive">Something went wrong.</Alert>
          </div>
        </section>

        <Separator />

        {/* Form Controls Section */}
        <section className="section">
          <div className="section-header">
            <h2>Form Controls</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Input fields and controls.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body space-y-4">
                <div className="space-y-2">
                  <label htmlFor="example-text" className="text-sm font-medium">Text Input</label>
                  <Input id="example-text" placeholder="Enter text..." />
                </div>
                <div className="space-y-2">
                  <label htmlFor="example-date" className="text-sm font-medium">Date Input</label>
                  <Input id="example-date" type="date" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="example-number" className="text-sm font-medium">Number Input</label>
                  <Input id="example-number" type="number" placeholder="0.00" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4>Toggle Setting</h4>
                    <p className="text-sm text-muted-foreground">Enable this feature</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Spacing Section */}
        <section className="section">
          <div className="section-header">
            <h2>Spacing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consistent spacing scale.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-body">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 6, 8].map((n) => (
                    <div key={n} className="flex items-center gap-4">
                      <span className="w-12 text-sm text-muted-foreground">gap-{n}</span>
                      <div className={`flex gap-${n}`}>
                        <div className="h-8 w-8 rounded bg-primary" />
                        <div className="h-8 w-8 rounded bg-primary" />
                        <div className="h-8 w-8 rounded bg-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
