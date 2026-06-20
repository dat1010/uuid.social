import { Form, Link } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

export function ObjectPageHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="navbar bg-base-100/90 backdrop-blur border-b border-base-300 px-4 lg:px-8 sticky top-0 z-20">
      <div className="navbar-start"><Link className="font-bold tracking-widest uppercase text-sm" to={signedIn ? "/home" : "/"}>uuid.social</Link></div>
      <div className="navbar-end gap-1">
        <Link className="btn btn-ghost btn-sm" to="/bounties">Bounties</Link>
        <ThemeToggle />
        {signedIn ? <><Link className="btn btn-ghost btn-sm" to="/home">Home</Link><Form action="/logout" method="post"><button className="btn btn-ghost btn-sm">Logout</button></Form></> : <Link className="btn btn-primary btn-sm" to="/login">Sign in</Link>}
      </div>
    </header>
  );
}
