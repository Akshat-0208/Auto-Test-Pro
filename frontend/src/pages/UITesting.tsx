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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import axios from "axios";
import { Checkbox } from "@/components/ui/checkbox";

const UITesting = () => {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [testConfig, setTestConfig] = useState({
		testLinks: true,
		testForms: true,
		testButtons: true,
		testImages: true,
		testResponsive: true,
		maxDepth: 3,
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!url) {
			toast.error("Please enter a URL to test");
			return;
		}

		setLoading(true);

		try {
			const response = await axios.post(
				"http://localhost:5000/api/ui-test",
				{
					url,
					config: testConfig,
				}
			);

			toast.success("UI test started successfully");
			setUrl("");
		} catch (error) {
			toast.error("Failed to start UI test");
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
					<CardTitle>UI Testing</CardTitle>
					<CardDescription>
						Test the user interface of any website
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="url">Website URL</Label>
							<Input
								id="url"
								placeholder="https://example.com"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-4">
							<h3 className="text-sm font-medium">
								Test Configuration
							</h3>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="testLinks"
										checked={testConfig.testLinks}
										onCheckedChange={handleCheckboxChange(
											"testLinks"
										)}
									/>
									<Label htmlFor="testLinks">
										Test Links
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testForms"
										checked={testConfig.testForms}
										onCheckedChange={handleCheckboxChange(
											"testForms"
										)}
									/>
									<Label htmlFor="testForms">
										Test Forms
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testButtons"
										checked={testConfig.testButtons}
										onCheckedChange={handleCheckboxChange(
											"testButtons"
										)}
									/>
									<Label htmlFor="testButtons">
										Test Buttons
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testImages"
										checked={testConfig.testImages}
										onCheckedChange={handleCheckboxChange(
											"testImages"
										)}
									/>
									<Label htmlFor="testImages">
										Test Images
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="testResponsive"
										checked={testConfig.testResponsive}
										onCheckedChange={handleCheckboxChange(
											"testResponsive"
										)}
									/>
									<Label htmlFor="testResponsive">
										Test Responsive Design
									</Label>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex justify-between">
									<Label htmlFor="maxDepth">
										Max Crawl Depth: {testConfig.maxDepth}
									</Label>
								</div>
								<Slider
									id="maxDepth"
									min={1}
									max={10}
									step={1}
									value={[testConfig.maxDepth]}
									onValueChange={(values) =>
										setTestConfig((prev) => ({
											...prev,
											maxDepth: values[0],
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
							{loading ? (
								<div className="flex items-center gap-2">
									<Spinner size="sm" />
									<span>Testing...</span>
								</div>
							) : (
								"Start Testing"
							)}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
};

export default UITesting;
