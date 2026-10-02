import { AppShell } from "./components/shell/AppShell";
import { Overview } from "./pages/Overview";
import { Providers } from "./pages/Providers";
import { Models } from "./pages/Models";
import { ModelRoles } from "./pages/ModelRoles";
import { SystemPrompts } from "./pages/SystemPrompts";
import { Resources } from "./pages/Resources";
import { Mcp } from "./pages/Mcp";
import { Tools } from "./pages/Tools";
import { Memory } from "./pages/Memory";
import { Settings } from "./pages/Settings";
import { Backup } from "./pages/Backup";

export function App() {
  return (
    <AppShell>
      {(route) => {
        switch (route.page) {
          case "providers":
            return <Providers param={route.param} />;
          case "models":
            return <Models />;
          case "roles":
            return <ModelRoles />;
          case "prompts":
            return <SystemPrompts />;
          case "skills":
            return <Resources resource="skills" />;
          case "agents":
            return <Resources resource="agents" />;
          case "hooks":
            return <Resources resource="hooks_pre" />;
          case "extensions":
            return <Resources resource="extensions" />;
          case "mcp":
            return <Mcp />;
          case "tools":
            return <Tools />;
          case "memory":
            return <Memory />;
          case "settings":
            return <Settings />;
          case "backup":
            return <Backup />;
          case "overview":
          default:
            return <Overview />;
        }
      }}
    </AppShell>
  );
}
