import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { TestResultDetails } from "@/components/TestResultDetails";
import axios from "axios";

interface TestResult {
	type: string;
	url: string;
	status: string;
	date: string;
	config: any;
	testsRun: number;
	passRate: number;
	duration: number;
	testResults: any[];
}

export default function Results() {
	const [results, setResults] = useState<TestResult[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selectedResult, setSelectedResult] = useState<TestResult | null>(
		null
	);
	const [showDetails, setShowDetails] = useState(false);

	const fetchResults = async () => {
		try {
			const response = await axios.get(
				"http://localhost:5000/api/results"
			);
			setResults(response.data);
		} catch (error) {
			toast.error("Failed to fetch results");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchResults();
	}, []);

	const filteredResults = results.filter((result) => {
		const matchesFilter = filter === "all" || result.type === filter;
		const matchesSearch = result.url
			.toLowerCase()
			.includes(search.toLowerCase());
		return matchesFilter && matchesSearch;
	});

	const itemsPerPage = 10;
	const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
	const paginatedResults = filteredResults.slice(
		(page - 1) * itemsPerPage,
		page * itemsPerPage
	);

	const handleResultClick = (result: TestResult) => {
		setSelectedResult(result);
		setShowDetails(true);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div className="container mx-auto p-4">
			<Card>
				<CardHeader>
					<CardTitle>Test Results</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex gap-4">
							<Input
								placeholder="Search by URL..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="max-w-sm"
							/>
							<select
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
								className="border rounded-md px-3 py-2"
							>
								<option value="all">All Tests</option>
								<option value="ui">UI Tests</option>
								<option value="api">API Tests</option>
							</select>
						</div>

						<div className="rounded-md border">
							<table className="w-full">
								<thead>
									<tr className="border-b bg-muted/50">
										<th className="p-2 text-left">URL</th>
										<th className="p-2 text-left">Type</th>
										<th className="p-2 text-left">
											Status
										</th>
										<th className="p-2 text-left">Date</th>
										<th className="p-2 text-left">
											Pass Rate
										</th>
									</tr>
								</thead>
								<tbody>
									{paginatedResults.map((result, index) => (
										<tr
											key={index}
											className="border-b hover:bg-muted/50 cursor-pointer"
											onClick={() =>
												handleResultClick(result)
											}
										>
											<td className="p-2">
												{result.url}
											</td>
											<td className="p-2 capitalize">
												{result.type}
											</td>
											<td className="p-2">
												<Badge
													variant={
														result.status ===
														"completed"
															? "success"
															: "destructive"
													}
												>
													{result.status}
												</Badge>
											</td>
											<td className="p-2">
												{new Date(
													result.date
												).toLocaleString()}
											</td>
											<td className="p-2">
												{result.passRate.toFixed(1)}%
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="flex justify-between items-center">
							<div className="text-sm text-muted-foreground">
								Showing {paginatedResults.length} of{" "}
								{filteredResults.length} results
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() =>
										setPage((p) => Math.max(1, p - 1))
									}
									disabled={page === 1}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										setPage((p) =>
											Math.min(totalPages, p + 1)
										)
									}
									disabled={page === totalPages}
								>
									Next
								</Button>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{selectedResult && (
				<TestResultDetails
					result={selectedResult}
					open={showDetails}
					onOpenChange={setShowDetails}
				/>
			)}
		</div>
	);
}
