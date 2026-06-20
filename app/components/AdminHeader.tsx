import { Form, Link } from "react-router";

import { ThemeToggle } from "./ThemeToggle";

export function AdminHeader() {
  return (
    <header className="admin-header">
      <Link className="admin-wordmark" to="/admin"><span>uuid.social</span><strong>CONTROL</strong></Link>
      <nav className="flex items-center gap-1">
        <Link className="btn btn-ghost btn-sm" to="/home">Home</Link>
        <ThemeToggle />
        <Form action="/logout" method="post"><button className="btn btn-ghost btn-sm">Logout</button></Form>
      </nav>
    </header>
  );
}
