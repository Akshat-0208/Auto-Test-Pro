import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/layout/Navbar";
import UITesting from "@/pages/UITesting";
import APITesting from "@/pages/APITesting";
import Results from "@/pages/Results";

function App() {
	return (
		<Router>
			<div className="min-h-screen bg-background">
				<Navbar />
				<main>
					<Routes>
						<Route path="/" element={<UITesting />} />
						<Route path="/ui-testing" element={<UITesting />} />
						<Route path="/api-testing" element={<APITesting />} />
						<Route path="/results" element={<Results />} />
					</Routes>
				</main>
				<Toaster position="top-right" />
			</div>
		</Router>
	);
}

export default App;
