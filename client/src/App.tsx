import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import Accounts from "@/pages/Accounts";
import OAuthSetup from "@/pages/OAuthSetup";
import OAuthCallback from "@/pages/OAuthCallback";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/oauth/setup" component={OAuthSetup} />
      <Route path="/oauth/callback" component={OAuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
