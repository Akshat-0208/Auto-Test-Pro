import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Monitor, FileJson, BarChart3 } from "lucide-react";

const Navbar = () => {
	return (
		<nav className="border-b">
			<div className="container flex h-16 items-center px-4">
				<Link
					to="/"
					className="flex items-center gap-2 font-bold text-xl"
				>
					<CheckCircle className="h-6 w-6" />
					<span>AutoTester</span>
				</Link>
				<div className="flex items-center gap-4 ml-auto">
					<Button asChild variant="ghost">
						<Link
							to="/ui-testing"
							className="flex items-center gap-2"
						>
							<Monitor className="h-4 w-4" />
							<span>UI Testing</span>
						</Link>
					</Button>
					<Button asChild variant="ghost">
						<Link
							to="/api-testing"
							className="flex items-center gap-2"
						>
							<FileJson className="h-4 w-4" />
							<span>API Testing</span>
						</Link>
					</Button>
					<Button asChild variant="ghost">
						<Link to="/results" className="flex items-center gap-2">
							<BarChart3 className="h-4 w-4" />
							<span>Results</span>
						</Link>
					</Button>
				</div>
			</div>
		</nav>
	);
};

export default Navbar;
