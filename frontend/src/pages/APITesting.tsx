import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import axios from "axios";

const APITesting = () => {
	const [endpoint, setEndpoint] = useState("");
	const [loading, setLoading] = useState(false);
	const [testConfig, setTestConfig] = useState({
		method: "GET",
		testParams: true,
		testHeaders: true,
		testResponseTime: true,
		testErrorCases: true,
		maxRequests: 50,
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!endpoint) {
			toast.error("Please enter an API endpoint to test");
			return;
		}

		setLoading(true);

		try {
			const response = await axios.post(
				"http://localhost:5000/api/api-test",
				{
					endpoint,
					config: testConfig,
				}
			);

			toast.success("API tests started successfully");
			console.log(response.data);
		} catch (error) {
			toast.error("Failed to start API tests");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	const handleCheckboxChange = (key: string) => (checked: boolean) => {
		setTestConfig((prev) => ({
			...prev,
			[key]: checked,
		}));
	};

	return (
		<div className="container mx-auto py-8">
			<Card>
				<CardHeader>
					<CardTitle>API Testing</CardTitle>
					<CardDescription>
						Test RESTful APIs for functionality and performance
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="endpoint">API Endpoint</Label>
							<Input
								id="endpoint"
								placeholder="https://api.example.com/endpoint"
								value={endpoint}
								onChange={(e) => setEndpoint(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-4">
							<h3 className="text-sm font-medium">
								Test Configuration
							</h3>

							<div className="space-y-2">
								<Label htmlFor="method">HTTP Method</Label>
								<Select
									value={testConfig.method}
									onValueChange={(value) =>
										setTestConfig((prev) => ({
											...prev,
											method: value,
										}))
									}
								>
									<SelectTrigger id="method">
										<SelectValue placeholder="Select HTTP Method" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="GET">GET</SelectItem>
										<SelectItem value="POST">
											POST
										</SelectItem>
										<SelectItem value="PUT">PUT</SelectItem>
										<SelectItem value="DELETE">
											DELETE
										</SelectItem>
										<SelectItem value="PATCH">
											PATCH
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="testParams"
										checked={testConfig.testParams}
										onCheckedChange={handleCheckboxChange(
											"testParams"
										)}
									/>
									<Label htmlFor="testParams">
										Test Query Parameters
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testHeaders"
										checked={testConfig.testHeaders}
										onCheckedChange={handleCheckboxChange(
											"testHeaders"
										)}
									/>
									<Label htmlFor="testHeaders">
										Test Headers
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testResponseTime"
										checked={testConfig.testResponseTime}
										onCheckedChange={handleCheckboxChange(
											"testResponseTime"
										)}
									/>
									<Label htmlFor="testResponseTime">
										Test Response Time
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testErrorCases"
										checked={testConfig.testErrorCases}
										onCheckedChange={handleCheckboxChange(
											"testErrorCases"
										)}
									/>
									<Label htmlFor="testErrorCases">
										Test Error Cases
									</Label>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex justify-between">
									<Label htmlFor="maxRequests">
										Max Requests: {testConfig.maxRequests}
									</Label>
								</div>
								<Slider
									id="maxRequests"
									min={10}
									max={200}
									step={10}
									value={[testConfig.maxRequests]}
									onValueChange={(values) =>
										setTestConfig((prev) => ({
											...prev,
											maxRequests: values[0],
										}))
									}
								/>
							</div>
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={loading}
						>
							{loading
								? "Starting Tests..."
								: "Start API Testing"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
};

export default APITesting;
