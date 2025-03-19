// Delete a test result
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if the test result exists
        const result = await Test.findById(id);

        if (!result) {
            return res.status(404).json({ message: 'Test result not found' });
        }

        // Delete the test result
        await Test.findByIdAndDelete(id);

        res.status(200).json({ message: 'Test result deleted successfully' });
    } catch (error) {
        console.error('Error deleting test result:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}); 